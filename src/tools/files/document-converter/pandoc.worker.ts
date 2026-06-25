// Web Worker that runs pandoc (compiled to WebAssembly) off the main thread.
//
// The 56 MB pandoc.wasm is fetched in the background as soon as the tool page
// opens (an `init` message is sent on mount), so the engine is warm by the
// time the user converts. The pandoc instance is reused for every conversion.
// Everything stays in the browser; the only network call is fetching the local
// WASM asset.

import { createPandocInstance } from 'wasm-pandoc/src/core.js';
import wasmUrl from 'wasm-pandoc/src/pandoc.wasm?url';

type FilesMap = Record<string, Blob | string>;

interface InitMessage {
  type: 'init';
}

interface ConvertRequest {
  id: number;
  type: 'convert';
  options: Record<string, unknown>;
  stdin: string | null;
  files: FilesMap;
}

type InMessage = InitMessage | ConvertRequest;

interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent) => void) | null;
}

const ctx = self as unknown as WorkerScope;

let pandocPromise: Promise<Awaited<ReturnType<typeof createPandocInstance>>> | null = null;

function postProgress(stage: string, extra?: Record<string, unknown>): void {
  ctx.postMessage({ type: 'progress', stage, ...extra });
}

// Fetch the WASM with a streaming reader so we can report byte-level download
// progress. Posts throttled `downloading` updates, then `compiling` while the
// engine boots, then `ready`.
async function fetchWithProgress(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load pandoc.wasm (HTTP ${res.status}).`);

  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastReported = 0;
  // Report at most every ~1% (or ~1 MB when size is unknown), and never more
  // often than ~80 ms, to avoid flooding the main thread.
  const step = total > 0 ? Math.max(total / 100, 256 * 1024) : 1024 * 1024;
  let lastTime = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const now = performance.now();
    if (loaded - lastReported >= step && now - lastTime >= 80) {
      lastReported = loaded;
      lastTime = now;
      postProgress('downloading', { loaded, total });
    }
  }
  postProgress('downloading', { loaded, total: total || loaded });
  // Assemble the chunks into a single buffer.
  const buf = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  return buf.buffer;
}

async function ensurePandoc(): Promise<Awaited<ReturnType<typeof createPandocInstance>>> {
  if (pandocPromise) return pandocPromise;
  pandocPromise = (async () => {
    postProgress('downloading', { loaded: 0, total: 0 });
    const buf = await fetchWithProgress(wasmUrl);
    postProgress('compiling');
    const instance = await createPandocInstance(buf);
    postProgress('ready');
    return instance;
  })();
  // On failure, drop the cached promise so a later `init`/convert can retry.
  pandocPromise.catch(() => {
    pandocPromise = null;
  });
  return pandocPromise;
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data as InMessage | undefined;
  if (!msg) return;

  if (msg.type === 'init') {
    try {
      await ensurePandoc();
    } catch (err) {
      postProgress('init-error', { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (msg.type === 'convert') {
    try {
      const instance = await ensurePandoc();
      const result = await instance.convert(msg.options, msg.stdin, msg.files);

      const outFiles: Record<string, Blob> = {};
      const outFile = typeof msg.options['output-file'] === 'string' ? msg.options['output-file'] : null;
      if (outFile && result.files[outFile]) outFiles[outFile] = result.files[outFile];

      ctx.postMessage({
        id: msg.id,
        type: 'result',
        ok: true,
        stdout: result.stdout,
        stderr: result.stderr,
        warnings: result.warnings,
        outFiles,
      });
    } catch (err) {
      ctx.postMessage({
        id: msg.id,
        type: 'result',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
