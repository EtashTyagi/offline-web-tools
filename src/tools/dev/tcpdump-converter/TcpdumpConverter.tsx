import { useEffect, useRef, useState } from 'react';
import { parseTcpdump, bytesToHex, bytesToPythonLiteral, toScapy } from './parse';
import { trackToolUse } from '../../../lib/track';

type OutputKind = 'scapy' | 'hex' | 'pybytes';

const OUTPUTS: { id: OutputKind; label: string; ext: string }[] = [
  { id: 'scapy', label: 'Scapy Python', ext: 'py' },
  { id: 'hex', label: 'Hex', ext: 'txt' },
  { id: 'pybytes', label: 'Raw bytes (Python)', ext: 'py' },
];

const SAMPLE = [
  '12:00:00.000123 IP 10.0.0.1.443 > 10.0.0.2.5000: Flags [S],',
  '  0x0000:  aabb ccdd eeff 1122 3344 5566 0800 4500  ........"3Uf..E.',
  '  0x0010:  003c 0001 0000 4006 0000 0a00 0001 0a00  .<....@.........',
  '  0x0020:  0002 01bb 1388 0000 0001 0000 0000 5002  ..........P.',
].join('\n');

function triggerDownload(text: string, name: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TcpdumpConverter() {
  const [input, setInput] = useState('');
  const [kind, setKind] = useState<OutputKind>('scapy');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ packets: number; bytes: number } | null>(null);

  const usedRef = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('tcpdump-converter', 'dev');
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => setInput(text));
  }

  function run() {
    setError(null);
    setCopied(false);
    try {
      const pkts = parseTcpdump(input);
      if (pkts.length === 0) {
        setError('No hex bytes found. Paste a tcpdump hex dump (e.g. tcpdump -x/-X output) or plain hex.');
        setOutput('');
        setStats(null);
        return;
      }
      setStats({ packets: pkts.length, bytes: pkts.reduce((n, p) => n + p.bytes.length, 0) });
      if (kind === 'scapy') setOutput(toScapy(pkts));
      else if (kind === 'hex') {
        setOutput(pkts.map((p, i) => `# packet ${i}\n${bytesToHex(p.bytes)}`).join('\n\n'));
      } else {
        setOutput(pkts.map((p, i) => `pkt${i} = ${bytesToPythonLiteral(p.bytes)}`).join('\n'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOutput('');
    }
  }

  function copy() {
    if (!output) return;
    navigator.clipboard?.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const activeExt = OUTPUTS.find((o) => o.id === kind)!.ext;

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label htmlFor="kind" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Output format
            </label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as OutputKind)} className="input">
              {OUTPUTS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="btn-secondary cursor-pointer text-sm">
            Load file
            <input type="file" className="hidden" onChange={handleFile} accept=".txt,.log,.tcpdump,text/plain" />
          </label>
          <button type="button" onClick={() => setInput(SAMPLE)} className="btn-secondary text-sm">Sample</button>
          <button type="button" onClick={run} className="btn-primary text-sm">Convert</button>
        </div>
        {stats && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Parsed {stats.packets} packet(s), {stats.bytes} byte(s).
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">tcpdump input</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder={'Paste a tcpdump hex dump, e.g. tcpdump -X output:\n  0x0000:  aabb ccdd eeff ...  ........'}
            className="h-80 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{OUTPUTS.find((o) => o.id === kind)!.label}</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={copy} className="btn-secondary px-2 py-1 text-xs" disabled={!output}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => triggerDownload(output, `tcpdump.${activeExt}`)}
                className="btn-secondary px-2 py-1 text-xs"
                disabled={!output}
              >
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
              className="h-80 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          )}
        </div>
      </div>

      <details className="card text-sm text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">How it works</summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed">
          <p>Paste output from <code>tcpdump -x</code>, <code>-xx</code>, <code>-X</code>, or <code>-XX</code>, or plain hex bytes. The tool strips offsets and the ASCII column and decodes each packet.</p>
          <p><strong>Scapy Python</strong> reconstructs each layer (<code>Ether</code>, <code>IP</code>, <code>IPv6</code>, <code>TCP</code>, <code>UDP</code>, <code>ICMP</code>, <code>ARP</code>, <code>VXLAN</code>, <code>MPLS</code>, <code>GRE</code>) and attaches any leftover payload as <code>Raw(load=...)</code> so <code>bytes(pkt)</code> matches the original.</p>
          <p><strong>Hex</strong> emits a continuous lowercase hex string per packet. <strong>Raw bytes (Python)</strong> emits a <code>b'...'</code> literal with printable ASCII kept as characters.</p>
          <p>Everything runs in your browser. Nothing is uploaded.</p>
        </div>
      </details>
    </div>
  );
}
