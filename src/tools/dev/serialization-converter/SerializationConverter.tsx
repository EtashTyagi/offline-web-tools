import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FORMATS,
  getFormat,
  decode,
  encode,
  bytesToBase64,
  base64ToBytes,
} from './codecs';
import { trackToolUse } from '../../../lib/track';

type InputMethod = 'paste' | 'file';
type Encoding = 'hex' | 'base64' | 'raw';

const TARGETABLE = FORMATS.filter((f) => f.supportsEncode);

function parseHex(text: string): Uint8Array {
  const cleaned = text.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length % 2 !== 0) throw new Error('Hex input has an odd number of digits.');
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function parsePaste(text: string, encoding: Encoding): Uint8Array {
  if (encoding === 'hex') return parseHex(text);
  if (encoding === 'base64') return base64ToBytes(text.replace(/\s+/g, ''));
  return new TextEncoder().encode(text);
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export default function SerializationConverter() {
  const [sourceFormat, setSourceFormat] = useState('bson');
  const [targetFormat, setTargetFormat] = useState('json');
  const [inputMethod, setInputMethod] = useState<InputMethod>('paste');
  const [encoding, setEncoding] = useState<Encoding>('base64');
  const [pasteInput, setPasteInput] = useState('');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);

  const usedRef = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('serialization-converter', 'dev');
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const srcFmt = getFormat(sourceFormat);
  const tgtFmt = getFormat(targetFormat);
  const targetIsJson = targetFormat === 'json';
  const sourceIsJson = sourceFormat === 'json';

  // Keep target valid (always encodable) when source changes.
  useEffect(() => {
    if (!getFormat(targetFormat)?.supportsEncode) setTargetFormat('json');
  }, [targetFormat]);

  function swapFormats() {
    // Only allow swap when the current source can be encoded (becomes target).
    if (srcFmt?.supportsEncode && tgtFmt) {
      setSourceFormat(targetFormat);
      setTargetFormat(sourceFormat);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    file.arrayBuffer().then((buf) => {
      setFileBytes(new Uint8Array(buf));
    });
  }

  function handleConvert() {
    setError(null);
    setOutputBytes(null);
    setCopied(false);
    try {
      // 1. Read raw input bytes/text.
      let bytes: Uint8Array;
      if (inputMethod === 'file') {
        if (!fileBytes) { setError('Choose a file first.'); return; }
        bytes = fileBytes;
      } else {
        if (!pasteInput.trim()) { setError('Paste some input first.'); return; }
        bytes = parsePaste(pasteInput, sourceIsJson ? 'raw' : encoding);
      }

      // 2. Decode source format to a JSON-friendly value.
      const decoded = decode(sourceFormat, bytes);
      if (!decoded.ok) { setError(decoded.error); setOutput(''); return; }

      // 3. Encode value into the target format.
      const encoded = encode(targetFormat, decoded.value);
      if (!encoded.ok) { setError(encoded.error); setOutput(''); return; }

      setOutputBytes(encoded.bytes);
      if (targetIsJson) {
        setOutput(new TextDecoder().decode(encoded.bytes));
      } else {
        setOutput(
          `// Encoded ${encoded.bytes.length} byte(s)\n` +
          `// Base64\n${bytesToBase64(encoded.bytes)}\n\n` +
          `// Hex\n${bytesToHex(encoded.bytes)}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOutput('');
    }
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard?.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadOutput() {
    if (targetIsJson) {
      const blob = new Blob([output], { type: 'application/json' });
      triggerDownload(blob, 'converted.json');
    } else if (outputBytes) {
      const blob = new Blob([outputBytes as BlobPart], { type: 'application/octet-stream' });
      const ext = targetFormat === 'bson' ? 'bson' : targetFormat === 'msgpack' ? 'msgpack' : 'cbor';
      triggerDownload(blob, `converted.${ext}`);
    }
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadSample() {
    if (sourceIsJson) {
      setPasteInput('{\n  "name": "Ada Lovelace",\n  "born": 1815,\n  "fields": ["math", "computing"],\n  "pioneer": true\n}');
      setEncoding('raw');
      setInputMethod('paste');
      return;
    }
    if (sourceFormat === 'protobuf') {
      setPasteInput('089601 1207 74657374696e67');
      setEncoding('hex');
    } else {
      const sample = encode('bson', { msg: 'hi', n: 7, list: [1, 2, 3] });
      if (sample.ok) setPasteInput(bytesToBase64(sample.bytes));
      setEncoding('base64');
    }
    setInputMethod('paste');
  }

  const srcDescription = useMemo(() => srcFmt?.description ?? '', [srcFmt]);
  const tgtDescription = useMemo(() => tgtFmt?.description ?? '', [tgtFmt]);

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="card flex flex-col gap-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label htmlFor="src" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              From
            </label>
            <select id="src" value={sourceFormat} onChange={(e) => setSourceFormat(e.target.value)} className="input">
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={swapFormats}
            title="Swap source and target"
            disabled={!srcFmt?.supportsEncode}
            className="btn-secondary mb-0.5 h-10 w-10 justify-center p-0 disabled:opacity-40"
            aria-label="Swap source and target"
          >
            ⇄
          </button>
          <div>
            <label htmlFor="tgt" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              To
            </label>
            <select id="tgt" value={targetFormat} onChange={(e) => setTargetFormat(e.target.value)} className="input">
              {TARGETABLE.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:justify-between">
          <span>{srcDescription}</span>
          <span>{tgtDescription}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Input method</span>
            <div className="inline-flex rounded-lg ring-1 ring-slate-300 dark:ring-slate-600">
              <button
                type="button"
                onClick={() => setInputMethod('paste')}
                className={`rounded-l-lg px-3 py-2 text-sm ${inputMethod === 'paste' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('file')}
                className={`rounded-r-lg px-3 py-2 text-sm ${inputMethod === 'file' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
              >
                File
              </button>
            </div>
          </div>
          {!sourceIsJson && inputMethod === 'paste' && (
            <div>
              <label htmlFor="enc" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Paste encoding
              </label>
              <select
                id="enc"
                value={encoding}
                onChange={(e) => setEncoding(e.target.value as Encoding)}
                className="input"
              >
                <option value="base64">Base64</option>
                <option value="hex">Hex</option>
                <option value="raw">Raw bytes (UTF-8)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Split view */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Input pane */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{srcFmt?.label} input</h2>
            <button type="button" onClick={loadSample} className="btn-secondary px-2 py-1 text-xs">
              Sample
            </button>
          </div>

          {inputMethod === 'paste' ? (
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              spellCheck={false}
              placeholder={
                sourceIsJson
                  ? 'Paste JSON text'
                  : encoding === 'hex'
                    ? 'Paste hex bytes, e.g. 089601120774657374696e67'
                    : encoding === 'base64'
                      ? 'Paste base64 bytes'
                      : 'Paste raw text (e.g. XML plist)'
              }
              className="h-72 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-4 text-center dark:border-slate-600">
              <label className="cursor-pointer text-sm font-medium text-brand-600 dark:text-brand-400">
                <span>Choose a file</span>
                <input type="file" className="hidden" onChange={handleFile} />
              </label>
              {fileName ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {fileName}{fileBytes ? ` · ${fileBytes.length} bytes` : ''}
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  {sourceIsJson ? 'JSON file (read locally, never uploaded)' : 'Binary file (read locally, never uploaded)'}
                </p>
              )}
            </div>
          )}

          <button type="button" onClick={handleConvert} className="btn-primary w-full">
            Convert {srcFmt?.label} → {tgtFmt?.label}
          </button>
        </div>

        {/* Output pane */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{tgtFmt?.label} output</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCopy} className="btn-secondary px-2 py-1 text-xs" disabled={!output}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={downloadOutput} className="btn-secondary px-2 py-1 text-xs" disabled={!output}>
                Download
              </button>
            </div>
          </div>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          ) : (
            <textarea
              readOnly
              value={output}
              spellCheck={false}
              placeholder="Output appears here."
              className="h-72 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <details className="card text-sm text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
          About the output format
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed">
          <p>Conversion goes through a JSON-like intermediate, so any decodable format can become any encodable format (JSON, BSON, MessagePack, CBOR).</p>
          <p>Binary blobs are shown as tagged objects, e.g. <code>{'{ "__type": "bytes", "base64": "...", "length": 12 }'}</code>.</p>
          <p>Other special values use <code>__type</code> markers: <code>bigint</code>, <code>date</code>, <code>map</code>, <code>set</code>, <code>ObjectId</code>, <code>decimal</code>, <code>fixed64</code>, <code>fixed32</code>, and best-effort types like <code>java:object</code>, <code>java:array</code>, <code>java:enum</code>, <code>java:ref</code>, <code>java:class</code>, <code>pickle:instance</code>, <code>pickle:reduce</code>, <code>pickle:global</code>, <code>tuple</code>.</p>
          <p>Protobuf is decoded without a schema, so fields are keyed by number and repeated values are collected into arrays. Nested messages, UTF-8 strings, and raw bytes are detected heuristically.</p>
          <p>Python pickle and Java serialization are reconstructed on a best-effort basis. Custom classes, native code, and some exotic opcodes may be represented as tagged placeholders instead of fully reconstructed. Those formats are decode-only (source), since re-encoding them faithfully is not safe or well-defined.</p>
        </div>
      </details>
    </div>
  );
}
