import { useEffect, useMemo, useRef, useState } from 'react';
import {
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  getInputFormat,
  getOutputFormat,
  buildOptions,
  outputFilename,
} from './formats';
import { trackToolUse } from '../../../lib/track';

type InputMethod = 'paste' | 'file';
type WrapMode = 'auto' | 'none' | 'preserve';

interface ResultMsg {
  id: number;
  type: 'result';
  ok: boolean;
  stdout?: string;
  stderr?: string;
  warnings?: unknown[];
  outFiles?: Record<string, Blob>;
  error?: string;
}
interface ProgressMsg {
  type: 'progress';
  stage: 'downloading' | 'compiling' | 'ready' | 'init-error';
  loaded?: number;
  total?: number;
  error?: string;
}
type WorkerMsg = ResultMsg | ProgressMsg;

type EngineState = 'idle' | 'downloading' | 'compiling' | 'ready' | 'error';

const SAMPLE = '# Hello World\n\nThis is a **test** with some *emphasis*.\n\n## Section\n\n- one\n- two\n- three\n';

function mb(bytes: number): string {
  if (!bytes) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentConverter() {
  const [from, setFrom] = useState('markdown');
  const [to, setTo] = useState('html');
  const [standalone, setStandalone] = useState(true);
  const [toc, setToc] = useState(false);
  const [numberSections, setNumberSections] = useState(false);
  const [wrap, setWrap] = useState<WrapMode>('auto');
  const [inputMethod, setInputMethod] = useState<InputMethod>('paste');
  const [pasteInput, setPasteInput] = useState(SAMPLE);
  const [file, setFile] = useState<{ name: string; blob: Blob } | null>(null);
  const [output, setOutput] = useState('');
  const [outBlob, setOutBlob] = useState<Blob | null>(null);
  const [outName, setOutName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engine, setEngine] = useState<{ state: EngineState; loaded: number; total: number; error: string | null }>({
    state: 'idle',
    loaded: 0,
    total: 0,
    error: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const pending = useRef(new Map<number, (r: ResultMsg) => void>());
  const blobUrls = useRef<string[]>([]);
  const usedRef = useRef(false);

  const fromFmt = useMemo(() => getInputFormat(from), [from]);
  const toFmt = useMemo(() => getOutputFormat(to), [to]);
  const fromIsBinary = fromFmt?.text === false;
  const textOut = toFmt?.text ?? true;

  // Boot the worker and start preloading the pandoc engine in the background
  // as soon as the island hydrates, so the engine is warm by the time the
  // user converts.
  useEffect(() => {
    const w = new Worker(new URL('./pandoc.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerMsg;
      if (msg.type === 'progress') {
        if (msg.stage === 'downloading') {
          setEngine({ state: 'downloading', loaded: msg.loaded ?? 0, total: msg.total ?? 0, error: null });
        } else if (msg.stage === 'compiling') {
          setEngine((prev) => ({ ...prev, state: 'compiling' }));
        } else if (msg.stage === 'ready') {
          setEngine({ state: 'ready', loaded: 0, total: 0, error: null });
        } else if (msg.stage === 'init-error') {
          setEngine({ state: 'error', loaded: 0, total: 0, error: msg.error ?? 'Failed to load the engine.' });
        }
        return;
      }
      if (msg.type === 'result') {
        const resolver = pending.current.get(msg.id);
        if (resolver) {
          pending.current.delete(msg.id);
          resolver(msg);
        }
      }
    };
    // Kick off the background preload immediately.
    w.postMessage({ type: 'init' });
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  // Binary source formats can only come from a file.
  useEffect(() => {
    if (fromIsBinary && inputMethod === 'paste') setInputMethod('file');
  }, [fromIsBinary, inputMethod]);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      for (const u of blobUrls.current) URL.revokeObjectURL(u);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('document-converter', 'files');
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  function loadSample() {
    setFrom('markdown');
    setInputMethod('paste');
    setPasteInput(SAMPLE);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile({ name: f.name, blob: f });
  }

  function swap() {
    if (!OUTPUT_FORMATS.some((f) => f.id === from) || !INPUT_FORMATS.some((f) => f.id === to)) return;
    setFrom(to);
    setTo(from);
  }
  const canSwap = OUTPUT_FORMATS.some((f) => f.id === from) && INPUT_FORMATS.some((f) => f.id === to);

  async function convert() {
    setError(null);
    setNotice(null);
    setOutput('');
    setOutBlob(null);
    setCopied(false);
    const w = workerRef.current;
    if (!w) return;
    if (!fromFmt || !toFmt) return;
    if (engine.state === 'error') {
      setError(engine.error ?? 'The pandoc engine failed to load. Reload the page to try again.');
      return;
    }

    setBusy(true);
    try {
      let stdin: string | null = null;
      const files: Record<string, Blob | string> = {};
      const optionsInput: Parameters<typeof buildOptions>[0] = { from, to, standalone, toc, numberSections, wrap };
      const inputName = inputMethod === 'file' ? file?.name ?? null : null;

      if (inputMethod === 'file') {
        if (!file) { setError('Choose a file first.'); setBusy(false); return; }
        if (fromFmt.text) {
          stdin = await file.blob.text();
        } else {
          files[file.name] = file.blob;
        }
      } else {
        if (fromIsBinary) { setError('This source format needs a file. Switch to File input.'); setBusy(false); return; }
        if (!pasteInput.trim()) { setError('Paste some input first.'); setBusy(false); return; }
        stdin = pasteInput;
      }

      if (!textOut) optionsInput.outputFile = outputFilename(inputName, to);
      const options = buildOptions(optionsInput);
      if (inputMethod === 'file' && !fromFmt.text) options['input-file'] = file!.name;

      const id = ++reqId.current;
      const result = await new Promise<ResultMsg>((resolve) => {
        pending.current.set(id, resolve);
        w.postMessage({ id, type: 'convert', options, stdin, files });
      });

      if (!result.ok) {
        setError(result.error ?? 'Conversion failed.');
        setBusy(false);
        return;
      }

      const stderr = (result.stderr ?? '').trim();
      const hasOut = textOut ? !!(result.stdout && result.stdout.length) : !!result.outFiles && Object.keys(result.outFiles).length > 0;

      if (textOut) {
        setOutput(result.stdout ?? '');
        setOutName(outputFilename(inputName, to));
        if (!hasOut && stderr) setError(stderr);
        else if (stderr) setNotice(stderr);
      } else {
        const name = optionsInput.outputFile!;
        const blob = result.outFiles?.[name];
        if (!blob) {
          setError(stderr || 'Pandoc produced no output file.');
          setBusy(false);
          return;
        }
        for (const u of blobUrls.current) URL.revokeObjectURL(u);
        blobUrls.current = [URL.createObjectURL(blob)];
        setOutBlob(blob);
        setOutName(name);
        if (stderr) setNotice(stderr);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard?.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadText() {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, outName || 'output.txt');
  }

  function downloadBlob() {
    if (!outBlob) return;
    triggerDownload(outBlob, outName);
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const downloadPct = engine.total > 0 ? Math.min(100, Math.round((engine.loaded / engine.total) * 100)) : 0;
  const engineLoading = engine.state === 'downloading' || engine.state === 'compiling';

  return (
    <div className="flex flex-col gap-5">
      {/* Background engine status (non-blocking) */}
      {engineLoading && (
        <div className="card flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500 dark:border-slate-600 dark:border-t-brand-400" />
              {engine.state === 'downloading'
                ? 'Loading the pandoc engine in the background (one-time, ~56 MB)'
                : 'Starting the pandoc engine…'}
            </span>
            {engine.state === 'downloading' && engine.total > 0 && (
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {mb(engine.loaded)} / {mb(engine.total)} · {downloadPct}%
              </span>
            )}
          </div>
          {engine.state === 'downloading' && engine.total > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${downloadPct}%` }} />
            </div>
          )}
          <p className="text-xs text-slate-400">You can keep setting up your conversion. It will run as soon as the engine is ready.</p>
        </div>
      )}
      {engine.state === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          The pandoc engine could not load: {engine.error}. Reload the page to try again.
        </div>
      )}

      {/* Controls */}
      <div className="card flex flex-col gap-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label htmlFor="from" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">From</label>
            <select id="from" value={from} onChange={(e) => setFrom(e.target.value)} className="input">
              {INPUT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={swap}
            disabled={!canSwap}
            title="Swap source and target"
            className="btn-secondary mb-0.5 h-10 w-10 justify-center p-0 disabled:opacity-40"
            aria-label="Swap source and target"
          >
            ⇄
          </button>
          <div>
            <label htmlFor="to" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">To</label>
            <select id="to" value={to} onChange={(e) => setTo(e.target.value)} className="input">
              {OUTPUT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={standalone} onChange={(e) => setStandalone(e.target.checked)} className="accent-brand-600" />
            Standalone document
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={toc} onChange={(e) => setToc(e.target.checked)} className="accent-brand-600" />
            Table of contents
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={numberSections} onChange={(e) => setNumberSections(e.target.checked)} className="accent-brand-600" />
            Number sections
          </label>
          <label className="inline-flex items-center gap-2">
            Wrap
            <select value={wrap} onChange={(e) => setWrap(e.target.value as WrapMode)} className="input h-8 w-auto py-1">
              <option value="auto">Auto</option>
              <option value="none">None</option>
              <option value="preserve">Preserve</option>
            </select>
          </label>
        </div>
      </div>

      {/* Split view */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Input */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{fromFmt?.label} input</h2>
            <button type="button" onClick={loadSample} className="btn-secondary px-2 py-1 text-xs">Sample</button>
          </div>

          {!fromIsBinary && (
            <div className="inline-flex w-fit rounded-lg ring-1 ring-slate-300 dark:ring-slate-600">
              <button type="button" onClick={() => setInputMethod('paste')} className={`rounded-l-lg px-3 py-1.5 text-sm ${inputMethod === 'paste' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>Paste</button>
              <button type="button" onClick={() => setInputMethod('file')} className={`rounded-r-lg px-3 py-1.5 text-sm ${inputMethod === 'file' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>File</button>
            </div>
          )}

          {inputMethod === 'paste' && !fromIsBinary ? (
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              spellCheck={false}
              placeholder="Paste your document text"
              className="h-72 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-4 text-center dark:border-slate-600">
              <label className="cursor-pointer text-sm font-medium text-brand-600 dark:text-brand-400">
                <span>Choose a file</span>
                <input type="file" className="hidden" onChange={handleFile} />
              </label>
              {file ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{file.name} · {file.blob.size} bytes</p>
              ) : (
                <p className="text-xs text-slate-400">Read locally, never uploaded.</p>
              )}
            </div>
          )}

          <button type="button" onClick={convert} disabled={busy || engine.state === 'error'} className="btn-primary w-full">
            {busy
              ? (engine.state === 'downloading' || engine.state === 'compiling' ? 'Warming up engine…' : 'Converting…')
              : `Convert ${fromFmt?.label} → ${toFmt?.label}`}
          </button>
        </div>

        {/* Output */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{toFmt?.label} output</h2>
            <div className="flex items-center gap-2">
              {textOut ? (
                <>
                  <button type="button" onClick={copyOutput} className="btn-secondary px-2 py-1 text-xs" disabled={!output}>{copied ? 'Copied' : 'Copy'}</button>
                  <button type="button" onClick={downloadText} className="btn-secondary px-2 py-1 text-xs" disabled={!output}>Download</button>
                </>
              ) : (
                <button type="button" onClick={downloadBlob} className="btn-secondary px-2 py-1 text-xs" disabled={!outBlob}>Download {outName}</button>
              )}
            </div>
          </div>

          {busy && (engine.state === 'downloading' || engine.state === 'compiling') && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              {engine.state === 'downloading' ? 'Finishing engine download…' : 'Starting engine…'}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 whitespace-pre-wrap">{error}</div>
          )}
          {notice && !error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 whitespace-pre-wrap">{notice}</div>
          )}

          {textOut ? (
            <textarea
              readOnly
              value={output}
              spellCheck={false}
              placeholder="Output appears here."
              className="h-72 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <div className="flex h-72 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 p-3 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-900">
              {outBlob ? `Ready: ${outName} (${outBlob.size} bytes)` : 'Binary output will be available to download here.'}
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <details className="card text-sm text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">About this converter</summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed">
          <p>This runs the full <a className="text-brand-600 underline" href="https://pandoc.org" rel="noopener noreferrer" target="_blank">pandoc</a> engine compiled to WebAssembly, entirely in your browser. The first conversion downloads the engine (about 56 MB, cached afterwards); subsequent conversions are instant and offline.</p>
          <p>Supported sources include Markdown, HTML, LaTeX, reStructuredText, AsciiDoc, Org, Word (docx), OpenDocument, RTF, EPUB, Jupyter notebooks, and more. Targets include HTML, Markdown, LaTeX, docx, odt, rtf, epub, pptx, and many others.</p>
          <p>PDF output is not available because it needs an external typesetting engine that cannot run in the browser. Use LaTeX or Typst output and compile it elsewhere if you need PDF.</p>
        </div>
      </details>
    </div>
  );
}
