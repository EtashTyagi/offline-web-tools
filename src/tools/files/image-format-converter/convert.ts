// Image format conversion helpers.
//
// Pure, side-effect-free logic lives here so Vitest can test it without a real
// canvas. The browser-only decode/encode (createImageBitmap + canvas.toBlob)
// lives in the component and is exercised by Playwright e2e tests.
//
// Everything is 100% client-side. No network access.

export type OutputFormat = 'png' | 'jpeg' | 'webp';

export type ResizeMode = 'none' | 'width' | 'height' | 'percent' | 'max';

export interface OutputFormatInfo {
  id: OutputFormat;
  label: string;
  mime: string;
  ext: string;
  lossy: boolean;
  hasAlpha: boolean;
  qualityApplies: boolean;
}

export const OUTPUT_FORMATS: OutputFormatInfo[] = [
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', lossy: false, hasAlpha: true, qualityApplies: false },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', lossy: true, hasAlpha: false, qualityApplies: true },
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true, hasAlpha: true, qualityApplies: true },
];

export function getOutputFormat(id: string): OutputFormatInfo | undefined {
  return OUTPUT_FORMATS.find((f) => f.id === id);
}

/* ------------------------------------------------------------------ */
/* Input format detection (magic numbers)                             */
/* ------------------------------------------------------------------ */

export type InputFormat =
  | 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'ico'
  | 'avif' | 'heic' | 'svg' | 'unknown';

const MAGIC: { format: InputFormat; test: (b: Uint8Array) => boolean }[] = [
  { format: 'png', test: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { format: 'jpeg', test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { format: 'gif', test: (b) => b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61 },
  { format: 'bmp', test: (b) => b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d },
  { format: 'ico', test: (b) => b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00 },
  { format: 'webp', test: (b) => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { format: 'avif', test: (b) => b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66 },
  { format: 'heic', test: (b) => b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && ((b[8] === 0x68 && b[9] === 0x65 && b[10] === 0x69 && (b[11] === 0x63 || b[11] === 0x78)) || (b[8] === 0x6d && b[9] === 0x69 && b[10] === 0x66 && b[11] === 0x31)) },
];

export function detectFormat(bytes: Uint8Array): InputFormat {
  for (const { format, test } of MAGIC) {
    if (test(bytes)) return format;
  }
  // SVG is text-based: a leading XML/SVG declaration.
  const head = bytesToText(bytes.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'svg';
  return 'unknown';
}

function bytesToText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

export const INPUT_LABELS: Record<InputFormat, string> = {
  png: 'PNG', jpeg: 'JPEG', webp: 'WebP', gif: 'GIF', bmp: 'BMP',
  ico: 'ICO', avif: 'AVIF', heic: 'HEIC', svg: 'SVG', unknown: 'Unknown',
};

/* ------------------------------------------------------------------ */
/* Quality + resize math                                              */
/* ------------------------------------------------------------------ */

export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 0.92;
  return Math.min(100, Math.max(0, q)) / 100;
}

export interface ResizeOptions {
  mode: ResizeMode;
  value: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export function computeResize(srcW: number, srcH: number, opts: ResizeOptions): Dimensions {
  if (srcW <= 0 || srcH <= 0) return { width: srcW, height: srcH };
  switch (opts.mode) {
    case 'none':
      return { width: srcW, height: srcH };
    case 'width': {
      const w = Math.max(1, Math.round(opts.value));
      return { width: w, height: Math.max(1, Math.round((srcH * w) / srcW)) };
    }
    case 'height': {
      const h = Math.max(1, Math.round(opts.value));
      return { width: Math.max(1, Math.round((srcW * h) / srcH)), height: h };
    }
    case 'percent': {
      const p = Math.min(1000, Math.max(1, opts.value)) / 100;
      return { width: Math.max(1, Math.round(srcW * p)), height: Math.max(1, Math.round(srcH * p)) };
    }
    case 'max': {
      const cap = Math.max(1, opts.value);
      const scale = Math.min(cap / srcW, cap / srcH);
      return { width: Math.max(1, Math.round(srcW * scale)), height: Math.max(1, Math.round(srcH * scale)) };
    }
    default:
      return { width: srcW, height: srcH };
  }
}

/* ------------------------------------------------------------------ */
/* Filename + color helpers                                           */
/* ------------------------------------------------------------------ */

export function swapExtension(filename: string, newExt: string): string {
  const base = filename.replace(/\.[^./\\]+$/, '');
  return `${base}.${newExt}`;
}

export interface Rgb { r: number; g: number; b: number; }

export function parseHexColor(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function sizeDelta(original: number, converted: number): number {
  if (original <= 0) return 0;
  return Math.round(((converted - original) / original) * 100);
}

/* ------------------------------------------------------------------ */
/* Browser capability probes (no-op safe outside a browser)           */
/* ------------------------------------------------------------------ */

export function supportedOutputFormats(): OutputFormatInfo[] {
  if (typeof document === 'undefined') return OUTPUT_FORMATS;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const data = c.toDataURL('image/webp');
    const webpOk = data.startsWith('data:image/webp');
    return OUTPUT_FORMATS.filter((f) => f.id !== 'webp' || webpOk);
  } catch {
    return OUTPUT_FORMATS.filter((f) => f.id !== 'webp');
  }
}
