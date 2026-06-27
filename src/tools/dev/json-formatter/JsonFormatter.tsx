import { useEffect, useMemo, useRef, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import {
  type Indent,
  type FormatOptions,
  type FormatStats,
  type ParseError,
  type Token,
  SAMPLE,
  defaultOptions,
  formatJson,
  minifyJson,
  parseJson,
} from './formatter';

type Mode = 'format' | 'minify' | 'validate';
type InputMethod = 'paste' | 'file';

const INDENT_PRESETS: { id: string; label: string; indent: Indent }[] = [
  { id: 's2', label: '2 spaces', indent: { kind: 'spaces', count: 2 } },
  { id: 's4', label: '4 spaces', indent: { kind: 'spaces', count: 4 } },
  { id: 's8', label: '8 spaces', indent: { kind: 'spaces', count: 8 } },
  { id: 'tab', label: 'Tab', indent: { kind: 'tab' } },
];

export default function JsonFormatter() {
  const [mode, setMode] = useState<Mode>('format');
  const [inputMethod, setInputMethod] = useState<InputMethod>('paste');
  const [pasteInput, setPasteInput] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');
  const [options, setOptions] = useState<FormatOptions>(defaultOptions);
  const [indentMode, setIndentMode] = useState<string>('s2');
  const [customIndent, setCustomIndent] = useState(2);
  const [output, setOutput] = useState('');
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [error, setError] = useState<ParseError | null>(null);
  const [stats, setStats] = useState<FormatStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [highlight, setHighlight] = useState(false);

  const usedRef = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('json-formatter', 'dev');
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const indentPresetId = useMemo(() => {
    if (indentMode === 'custom') return 'custom';
    const indent = options.indent;
    if (indent.kind === 'tab') return 'tab';
    if (indent.kind === 'spaces') {
      const m = INDENT_PRESETS.find((p) => p.indent.kind === 'spaces' && p.indent.count === indent.count);
      return m ? m.id : 'custom';
    }
    return 's2';
  }, [indentMode, options.indent]);

  function setIndentPreset(id: string) {
    setIndentMode(id);
    if (id === 'custom') {
      setOptions((o) => ({ ...o, indent: { kind: 'spaces', count: Math.max(0, customIndent) } }));
      return;
    }
    const p = INDENT_PRESETS.find((p) => p.id === id);
    if (p) setOptions((o) => ({ ...o, indent: p.indent }));
  }

  const currentInput = inputMethod === 'paste' ? pasteInput : fileText;

  function runFormat() {
    setError(null);
    setStats(null);
    setTokens(null);
    setCopied(false);
    if (!currentInput.trim()) {
      setOutput('');
      setError({ message: 'Paste some JSON first.', line: 1, column: 1, position: 0 });
      return;
    }
    if (mode === 'validate') {
      const r = parseJson(currentInput);
      if (r.ok) {
        setOutput('JSON is valid.');
        return;
      }
      setOutput('');
      setError(r.error);
      return;
    }
    const r = mode === 'minify' ? minifyJson(currentInput) : formatJson(currentInput, options);
    if (!r.ok) {
      setOutput('');
      setError(r.error ?? { message: 'Unknown error', line: 0, column: 0, position: 0 });
      return;
    }
    setOutput(r.output);
    setTokens(r.tokens ?? null);
    setStats(r.stats ?? null);
  }

  function loadSample() {
    setPasteInput(SAMPLE);
    setInputMethod('paste');
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard?.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleClear() {
    setPasteInput('');
    setFileText('');
    setFileName('');
    setOutput('');
    setError(null);
    setStats(null);
  }

  function downloadOutput() {
    if (!output) return;
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'minify' ? 'minified.json' : 'formatted.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    file.text().then((t) => setFileText(t));
  }

  const errorSnippet = useMemo(() => {
    if (!error || error.position < 0) return null;
    const lines = currentInput.split('\n');
    const line = Math.max(1, Math.min(lines.length, error.line));
    const target = lines[line - 1] ?? '';
    const carets = ' '.repeat(Math.max(0, error.column - 1)) + '^';
    return { line, target, carets };
  }, [error, currentInput]);

  return (
    <div className="flex flex-col gap-5">
      {/* Mode + input method */}
      <div className="card flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Mode</span>
            <div className="inline-flex rounded-lg ring-1 ring-slate-300 dark:ring-slate-600">
              {(['format', 'minify', 'validate'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-2 text-sm capitalize first:rounded-l-lg last:rounded-r-lg ${mode === m ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Input</span>
            <div className="inline-flex rounded-lg ring-1 ring-slate-300 dark:ring-slate-600">
              {(['paste', 'file'] as InputMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInputMethod(m)}
                  className={`px-3 py-2 text-sm capitalize first:rounded-l-lg last:rounded-r-lg ${inputMethod === m ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mode === 'format' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="indent-preset" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Indent
              </label>
              <select
                id="indent-preset"
                value={indentPresetId}
                onChange={(e) => setIndentPreset(e.target.value)}
                className="input"
              >
                {INDENT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              {indentPresetId === 'custom' && (
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={customIndent}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
                    setCustomIndent(n);
                    setOptions((o) => ({ ...o, indent: { kind: 'spaces', count: n } }));
                  }}
                  className="input mt-2"
                  aria-label="Custom indent width"
                />
              )}
            </div>

            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={options.sortKeys}
                  onChange={(e) => setOptions((o) => ({ ...o, sortKeys: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Sort keys alphabetically
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={options.dropNulls}
                  onChange={(e) => setOptions((o) => ({ ...o, dropNulls: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Drop null values
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={options.escapeUnicode}
                  onChange={(e) => setOptions((o) => ({ ...o, escapeUnicode: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Escape non-ASCII
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
          <label className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              aria-label="Color syntax in output"
            />
            <span>Color syntax in output</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              keys, strings, numbers, booleans, null
            </span>
          </label>
        </div>
      </div>

      {/* Split view */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Input pane */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Input</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={loadSample} className="btn-secondary px-2 py-1 text-xs">Sample</button>
              <button type="button" onClick={handleClear} className="btn-secondary px-2 py-1 text-xs">Clear</button>
            </div>
          </div>

          {inputMethod === 'paste' ? (
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              spellCheck={false}
              placeholder="Paste JSON here…"
              className="h-80 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              aria-label="JSON input"
            />
          ) : (
            <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-4 text-center dark:border-slate-600">
              <label className="cursor-pointer text-sm font-medium text-brand-600 dark:text-brand-400">
                <span>Choose a .json file</span>
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
              </label>
              {fileName ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {fileName}{fileText ? ` · ${fileText.length.toLocaleString()} chars` : ''}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Read locally, never uploaded</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={runFormat}
            className="btn-primary w-full"
          >
            {mode === 'format' ? 'Format JSON' : mode === 'minify' ? 'Minify JSON' : 'Validate JSON'}
          </button>
        </div>

        {/* Output pane */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Output</h2>
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
              <p className="font-medium">Invalid JSON: {error.message}</p>
              {errorSnippet && (
                <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 font-mono text-xs dark:bg-red-950/50">
                  <span className="opacity-70">{errorSnippet.line} | </span>
                  {errorSnippet.target}
                  {'\n'}
                  <span className="opacity-70">{errorSnippet.line} | </span>
                  {errorSnippet.carets}
                </pre>
              )}
              {error.position > 0 && (
                <p className="mt-1 text-xs opacity-80">position {error.position}, line {error.line}, column {error.column}</p>
              )}
            </div>
          ) : highlight && tokens && tokens.length > 0 ? (
            <pre
              aria-label="JSON output"
              className="h-80 w-full overflow-auto whitespace-pre rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900"
            >
              {tokens.map((t, i) => (
                <span key={i} className={tokenClass(t.type)}>{t.text}</span>
              ))}
            </pre>
          ) : (
            <textarea
              readOnly
              value={output}
              spellCheck={false}
              placeholder="Formatted JSON appears here."
              className="h-80 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              aria-label="JSON output"
            />
          )}

          {stats && mode !== 'validate' && (
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-4">
              <Stat label="Input bytes" value={stats.inputBytes.toLocaleString()} />
              <Stat label="Output bytes" value={stats.outputBytes.toLocaleString()} />
              <Stat label="Keys" value={stats.totalKeys.toLocaleString()} />
              <Stat label="Max depth" value={stats.maxDepth.toLocaleString()} />
              {Object.entries(stats.typeCounts).map(([k, v]) => (
                <Stat key={k} label={k} value={v.toLocaleString()} />
              ))}
            </div>
          )}
        </div>
      </div>

      <details className="card text-sm text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">About the options</summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed">
          <p><strong>Indent.</strong> Choose 2, 4, or 8 spaces, a tab, or set a custom width (0–16). Minify mode ignores indent and produces the shortest valid JSON.</p>
          <p><strong>Sort keys.</strong> Recursively sorts object keys alphabetically at every level. Useful for diffing and for deterministic output in tests or version control.</p>
          <p><strong>Drop null values.</strong> Recursively removes keys whose value is <code>null</code> from objects. Arrays keep their length and order; null array elements are also dropped.</p>
          <p><strong>Escape non-ASCII.</strong> Encodes any character above U+007F as <code>\uXXXX</code> (with surrogate pairs for code points above U+FFFF), and escapes common control characters. Useful when you need pure-ASCII JSON.</p>
          <p><strong>Validate.</strong> Parses the input but does not transform it. On success it prints a confirmation. On failure it shows the error message, an excerpt of the offending line, and the byte position so you can locate the problem.</p>
          <p><strong>Color syntax.</strong> When enabled, the output is rendered with distinct colors for keys, strings, numbers, booleans, and <code>null</code> so structure is easier to scan. Toggle is off by default.</p>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="font-mono text-sm text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );
}

function tokenClass(type: Token['type']): string {
  switch (type) {
    case 'key':
      return 'text-sky-700 dark:text-sky-300';
    case 'string':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'number':
      return 'text-amber-700 dark:text-amber-300';
    case 'boolean':
      return 'text-violet-700 dark:text-violet-300';
    case 'null':
      return 'text-rose-700 dark:text-rose-300';
    case 'punct':
      return 'text-slate-500 dark:text-slate-400';
    case 'whitespace':
      return '';
  }
}