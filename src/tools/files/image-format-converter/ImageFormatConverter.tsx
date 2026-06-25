import { useEffect, useMemo, useRef, useState } from 'react';
import {
  supportedOutputFormats,
  getOutputFormat,
  detectFormat,
  INPUT_LABELS,
  clampQuality,
  computeResize,
  swapExtension,
  parseHexColor,
  formatBytes,
  sizeDelta,
  type OutputFormat,
  type ResizeMode,
  type InputFormat,
} from './convert';
import { trackToolUse } from '../../../lib/track';

type FileStatus = 'pending' | 'done' | 'error';

interface ResultItem {
  id: string;
  name: string;
  inputFormat: InputFormat;
  originalSize: number;
  status: FileStatus;
  blobUrl?: string;
  outName?: string;
  convertedSize?: number;
  width?: number;
  height?: number;
  error?: string;
}

interface ConvertSettings {
  format: OutputFormat;
  quality: number;
  mode: ResizeMode;
  value: number;
  bg: string;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `img-${idCounter}-${Date.now()}`;
}

async function decodeImage(file: File): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fmt = detectFormat(bytes);
  try {
    const bitmap = await createImageBitmap(new Blob([bytes]));
    if (bitmap.width > 0 && bitmap.height > 0) return { bitmap, width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    throw new Error('empty bitmap');
  } catch {
    // Fallback: <img> element (better for SVG and some GIFs).
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      if (canvas.width === 0 || canvas.height === 0) throw new Error(`Could not read image (format: ${INPUT_LABELS[fmt]}). Your browser may not decode this format.`);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');
      ctx.drawImage(img, 0, 0);
      const bitmap = await createImageBitmap(canvas);
      return { bitmap, width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load.'));
    img.src = url;
  });
}

function encodeImage(
  bitmap: ImageBitmap,
  settings: ConvertSettings,
): Promise<{ blob: Blob; width: number; height: number }> {
  const fmt = getOutputFormat(settings.format)!;
  const { width, height } = computeResize(bitmap.width, bitmap.height, { mode: settings.mode, value: settings.value });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D context unavailable.'));

  // Flatten transparency when the target lacks alpha, or when a background is set.
  const needsBg = !fmt.hasAlpha || (settings.bg.trim() !== '' && settings.bg.toLowerCase() !== '#ffffff');
  if (needsBg) {
    const rgb = parseHexColor(settings.bg) ?? { r: 255, g: 255, b: 255 };
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Your browser cannot encode ${fmt.label}. Try PNG or JPEG.`));
          return;
        }
        resolve({ blob, width, height });
      },
      fmt.mime,
      fmt.qualityApplies ? clampQuality(settings.quality) : undefined,
    );
  });
}

export default function ImageFormatConverter() {
  const formats = useMemo(() => supportedOutputFormats(), []);
  const [format, setFormat] = useState<OutputFormat>('webp');
  const [quality, setQuality] = useState(85);
  const [mode, setMode] = useState<ResizeMode>('none');
  const [value, setValue] = useState(100);
  const [bg, setBg] = useState('#ffffff');
  const [items, setItems] = useState<ResultItem[]>([]);
  const [converting, setConverting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ensure the chosen format is one the browser supports.
  useEffect(() => {
    if (!formats.some((f) => f.id === format)) {
      setFormat(formats[0]?.id ?? 'png');
    }
  }, [formats, format]);

  const usedRef = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('image-format-converter', 'files');
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const fmtInfo = getOutputFormat(format)!;
  const qualityApplies = fmtInfo.qualityApplies;

  const fileMap = useRef(new Map<string, File>());

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|ico|avif|heic|svg)$/i.test(f.name));
    if (files.length === 0) return;
    const next: ResultItem[] = files.map((file) => {
      const id = nextId();
      fileMap.current.set(id, file);
      return {
        id,
        name: file.name,
        inputFormat: 'unknown' as InputFormat,
        originalSize: file.size,
        status: 'pending' as FileStatus,
      };
    });
    setItems((prev) => [...prev, ...next]);
  }

  async function convertAll() {
    const pending = items.filter((i) => i.status === 'pending');
    if (pending.length === 0) return;
    setConverting(true);
    const settings: ConvertSettings = { format, quality, mode, value, bg };
    for (const item of pending) {
      const file = fileMap.current.get(item.id);
      if (!file) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: 'File missing.' } : i)));
        continue;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const inputFormat = detectFormat(bytes);
        const { bitmap } = await decodeImage(file);
        const { blob, width: ow, height: oh } = await encodeImage(bitmap, settings);
        bitmap.close?.();
        const outName = swapExtension(file.name, getOutputFormat(format)!.ext);
        const blobUrl = URL.createObjectURL(blob);
        setItems((prev) => prev.map((i) => (i.id === item.id ? {
          ...i,
          status: 'done',
          inputFormat,
          width: ow,
          height: oh,
          convertedSize: blob.size,
          blobUrl,
          outName,
        } : i)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: msg } : i)));
      }
    }
    setConverting(false);
  }

  function downloadOne(item: ResultItem) {
    if (!item.blobUrl || !item.outName) return;
    const a = document.createElement('a');
    a.href = item.blobUrl;
    a.download = item.outName;
    a.click();
  }

  function downloadAll() {
    items.filter((i) => i.status === 'done').forEach((i, idx) => setTimeout(() => downloadOne(i), idx * 150));
  }

  function clearAll() {
    for (const i of items) if (i.blobUrl) URL.revokeObjectURL(i.blobUrl);
    items.forEach((i) => fileMap.current.delete(i.id));
    setItems([]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.blobUrl) URL.revokeObjectURL(target.blobUrl);
      fileMap.current.delete(id);
      return prev.filter((i) => i.id !== id);
    });
  }

  useEffect(() => {
    return () => {
      for (const i of items) if (i.blobUrl) URL.revokeObjectURL(i.blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="flex flex-col gap-5">
      {/* Settings */}
      <div className="card flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="fmt" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Convert to</label>
            <select id="fmt" value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="input">
              {formats.map((f) => (
                <option key={f.id} value={f.id}>{f.label}{f.lossy ? ' (compressed)' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quality" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Quality: <span className="font-mono">{quality}</span>
            </label>
            <input
              id="quality"
              type="range"
              min={1}
              max={100}
              value={quality}
              disabled={!qualityApplies}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="h-10 w-full accent-brand-600 disabled:opacity-40"
            />
          </div>

          <div>
            <label htmlFor="rmode" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Resize</label>
            <select id="rmode" value={mode} onChange={(e) => setMode(e.target.value as ResizeMode)} className="input">
              <option value="none">No resize</option>
              <option value="width">Width (px)</option>
              <option value="height">Height (px)</option>
              <option value="percent">Percentage (%)</option>
              <option value="max">Max side (px)</option>
            </select>
          </div>

          <div>
            <label htmlFor="rval" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {mode === 'percent' ? 'Percent' : mode === 'max' ? 'Max side' : mode === 'none' ? 'Value' : mode === 'width' ? 'Width' : 'Height'}
            </label>
            <input
              id="rval"
              type="number"
              min={1}
              value={value}
              disabled={mode === 'none'}
              onChange={(e) => setValue(Number(e.target.value))}
              className="input disabled:opacity-40"
            />
          </div>
        </div>

        {!fmtInfo.hasAlpha && (
          <div className="flex items-center gap-3">
            <label htmlFor="bg" className="text-sm font-medium text-slate-700 dark:text-slate-300">Background (for transparency)</label>
            <input id="bg" type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-14 rounded border border-slate-300 dark:border-slate-600" />
            <span className="text-xs text-slate-500 dark:text-slate-400">{fmtInfo.label} has no transparency; transparent areas are filled with this color.</span>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop images here, or</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">
          Choose images
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.avif,.svg"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
        />
        <p className="text-xs text-slate-400">PNG, JPEG, WebP, GIF, BMP, AVIF, SVG, ICO. Read locally, never uploaded.</p>
      </div>

      {/* Actions */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={convertAll} disabled={converting || pendingCount === 0} className="btn-primary">
            {converting ? 'Converting…' : `Convert ${pendingCount > 0 ? pendingCount : ''} to ${fmtInfo.label}`.trim()}
          </button>
          {doneCount > 0 && (
            <button type="button" onClick={downloadAll} className="btn-secondary">Download all ({doneCount})</button>
          )}
          <button type="button" onClick={clearAll} className="btn-secondary">Clear</button>
        </div>
      )}

      {/* Results */}
      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={item.name}>{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {INPUT_LABELS[item.inputFormat]} · {formatBytes(item.originalSize)}
                  </p>
                </div>
                <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`} className="text-slate-400 hover:text-red-500">✕</button>
              </div>

              {item.status === 'done' && item.blobUrl && (
                <>
                  <img src={item.blobUrl} alt={item.outName} className="h-32 w-full rounded-lg bg-[conic-gradient(at_50%_50%,#e5e7eb_25%,#f8fafc_0_50%,#e5e7eb_0_75%,#f8fafc_0)] bg-[length:16px_16px] object-contain" />
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.width}×{item.height}</span>
                    <span>
                      {formatBytes(item.convertedSize ?? 0)}
                      {item.convertedSize !== undefined && (
                        <span className={sizeDelta(item.originalSize, item.convertedSize) <= 0 ? 'ml-1 text-emerald-600 dark:text-emerald-400' : 'ml-1 text-amber-600 dark:text-amber-400'}>
                          {sizeDelta(item.originalSize, item.convertedSize) > 0 ? '+' : ''}{sizeDelta(item.originalSize, item.convertedSize)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <button type="button" onClick={() => downloadOne(item)} className="btn-secondary w-full py-1.5 text-xs">Download {item.outName}</button>
                </>
              )}

              {item.status === 'pending' && (
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">Waiting to convert</div>
              )}

              {item.status === 'error' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                  {item.error}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* About */}
      <details className="card text-sm text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">How it works</summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed">
          <p>Images are decoded with your browser's built-in image support and re-encoded on a canvas. Nothing is uploaded.</p>
          <p>Output formats depend on your browser. PNG and JPEG work everywhere; WebP works in Chrome, Firefox, and Edge. AVIF/HEIC decoding depends on your browser and OS.</p>
          <p>JPEG has no transparency. When you convert a transparent PNG to JPEG, transparent pixels are filled with the background color you choose.</p>
          <p>Animated GIFs become a single still frame.</p>
        </div>
      </details>
    </div>
  );
}
