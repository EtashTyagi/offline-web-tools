import { useEffect, useRef, useState } from 'react';
import {
  parseTcpdump,
  parseHexInput,
  parseScapyString,
  parseScapyCode,
  parseRawBytesInput,
  detectFormat,
  toScapy,
  toScapyString,
  toHexOutput,
  toRawBytesOutput,
  toTcpdump,
} from './parse';
import type { InputFormat, OutputFormat, ParsedPacket } from './parse';
import { trackToolUse } from '../../../lib/track';

const INPUT_FORMATS: { id: InputFormat; label: string }[] = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'tcpdump', label: 'Tcpdump' },
  { id: 'hex', label: 'Hex' },
  { id: 'scapy-string', label: 'Scapy String' },
  { id: 'scapy-code', label: 'Scapy Code' },
  { id: 'raw-bytes', label: 'Raw Bytes' },
];

const OUTPUT_FORMATS: { id: OutputFormat; label: string; ext: string }[] = [
  { id: 'scapy-code', label: 'Scapy Python: Code', ext: 'py' },
  { id: 'scapy-string', label: 'Scapy Python: String', ext: 'txt' },
  { id: 'hex', label: 'Hex', ext: 'txt' },
  { id: 'raw-bytes', label: 'Raw Bytes', ext: 'py' },
  { id: 'tcpdump', label: 'Tcpdump', ext: 'txt' },
];

const SAMPLE_TCPDUMP = [
  '12:00:00.000123 IP 10.0.0.1.443 > 10.0.0.2.5000: Flags [S],',
  '  0x0000:  aabb ccdd eeff 1122 3344 5566 0800 4500  ........"3Uf..E.',
  '  0x0010:  003c 0001 0000 4006 0000 0a00 0001 0a00  .<....@.........',
  '  0x0020:  0002 01bb 1388 0000 0001 0000 0000 5002  ..........P.',
].join('\n');

const SAMPLE_SCAPY_STRING =
  '<Ether  dst=aa:bb:cc:dd:ee:ff src=11:22:33:44:55:66 type=IPv4 |<IP  version=4 ihl=5 tos=0x0 len=60 id=1 flags=010 frag=0 ttl=64 proto=tcp src=10.0.0.1 dst=10.0.0.2 |<TCP  sport=443 dport=5000 seq=1 ack=0 dataofs=5 flags=S window=8192 urgptr=0 |>>>';

const SAMPLE_SCAPY_CODE = [
  'from scapy.all import *',
  '',
  "pkt0 = Ether(dst='aa:bb:cc:dd:ee:ff', src='11:22:33:44:55:66', type=0x0800) / IP(version=4, ihl=5, tos=0, len=60, id=1, flags=2, frag=0, ttl=64, proto=6, src='10.0.0.1', dst='10.0.0.2') / TCP(sport=443, dport=5000, seq=1, ack=0, dataofs=5, flags='S', window=8192, urgptr=0)",
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

export default function PacketFormatConverter() {
  const [input, setInput] = useState('');
  const [inFmt, setInFmt] = useState<InputFormat>('auto');
  const [outFmt, setOutFmt] = useState<OutputFormat>('scapy-code');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ packets: number; bytes: number; detectedFormat: string } | null>(null);

  const usedRef = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('packet-format-converter', 'dev');
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => setInput(text));
  }

  function parseInput(format: InputFormat): ParsedPacket[] {
    const effectiveFormat = format === 'auto' ? detectFormat(input) : format;
    switch (effectiveFormat) {
      case 'tcpdump': return parseTcpdump(input);
      case 'hex': return parseHexInput(input);
      case 'scapy-string': return parseScapyString(input);
      case 'scapy-code': return parseScapyCode(input);
      case 'raw-bytes': return parseRawBytesInput(input);
      default: return parseTcpdump(input);
    }
  }

  function generateOutput(packets: ParsedPacket[], format: OutputFormat): string {
    switch (format) {
      case 'scapy-code': return toScapy(packets);
      case 'scapy-string': return toScapyString(packets);
      case 'hex': return toHexOutput(packets);
      case 'raw-bytes': return toRawBytesOutput(packets);
      case 'tcpdump': return toTcpdump(packets);
    }
  }

  function run() {
    setError(null);
    setCopied(false);
    try {
      const effectiveFormat = inFmt === 'auto' ? detectFormat(input) : inFmt;
      const pkts = parseInput(inFmt);
      if (pkts.length === 0) {
        setError(`No packets found in the input. Make sure the input is valid ${inFmt === 'auto' ? '' : `${inFmt}`} format.`);
        setOutput('');
        setStats(null);
        return;
      }
      setStats({
        packets: pkts.length,
        bytes: pkts.reduce((n, p) => n + p.bytes.length, 0),
        detectedFormat: effectiveFormat,
      });
      setOutput(generateOutput(pkts, outFmt));
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

  function loadSample() {
    const fmt = inFmt === 'auto' ? 'tcpdump' : inFmt;
    switch (fmt) {
      case 'tcpdump': setInput(SAMPLE_TCPDUMP); break;
      case 'scapy-string': setInput(SAMPLE_SCAPY_STRING); break;
      case 'scapy-code': setInput(SAMPLE_SCAPY_CODE); break;
      case 'hex': setInput('aabbccddeeff 112233445566 0800 4500003c0001000040060000 0a000001 0a000002 01bb1388000000010000000050022000'); break;
      case 'raw-bytes': setInput("b'\\xaa\\xbb\\xcc\\xdd\\xee\\xff\\x11\\x22\\x33\\x44\\x55\\x66\\x08\\x00E\\x00\\x00<\\x00\\x01\\x00\\x00@\\x06\\x00\\x00\\n\\x00\\x00\\x01\\n\\x00\\x00\\x02\\x01\\xbb\\x13\\x88\\x00\\x00\\x00\\x01\\x00\\x00\\x00\\x00P\\x02 '"); break;
      default: setInput(SAMPLE_TCPDUMP); break;
    }
  }

  const activeExt = OUTPUT_FORMATS.find((o) => o.id === outFmt)!.ext;
  const detectedLabel = stats ? INPUT_FORMATS.find((f) => f.id === stats.detectedFormat)?.label : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="inFmt" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Input format
            </label>
            <select id="inFmt" value={inFmt} onChange={(e) => setInFmt(e.target.value as InputFormat)} className="input">
              {INPUT_FORMATS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="outFmt" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Output format
            </label>
            <select id="outFmt" value={outFmt} onChange={(e) => setOutFmt(e.target.value as OutputFormat)} className="input">
              {OUTPUT_FORMATS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="btn-secondary cursor-pointer text-sm">
            Load file
            <input type="file" className="hidden" onChange={handleFile} accept=".txt,.log,.tcpdump,.py,text/plain" />
          </label>
          <button type="button" onClick={loadSample} className="btn-secondary text-sm">Sample</button>
          <button type="button" onClick={run} className="btn-primary text-sm">Convert</button>
        </div>
        {stats && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Parsed {stats.packets} packet(s), {stats.bytes} byte(s)
            {inFmt === 'auto' && detectedLabel && ` (detected: ${detectedLabel})`}.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Input</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder={'Paste packet data in any supported format:\n  tcpdump hex dump, hex bytes, Scapy string, Scapy code, or Python bytes literal'}
            className="h-80 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{OUTPUT_FORMATS.find((o) => o.id === outFmt)!.label}</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={copy} className="btn-secondary px-2 py-1 text-xs" disabled={!output}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => triggerDownload(output, `packets.${activeExt}`)}
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
          <p>Convert network packets between five formats. Paste data in any supported input format and get the output in your chosen format.</p>
          <p><strong>Input formats:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Tcpdump</strong> — output from <code>tcpdump -x</code>, <code>-xx</code>, <code>-X</code>, or <code>-XX</code></li>
            <li><strong>Hex</strong> — plain hex bytes (space-separated or continuous)</li>
            <li><strong>Scapy String</strong> — Scapy <code>repr()</code> output like <code>&lt;Ether dst=... |&lt;IP ...&gt;&gt;</code></li>
            <li><strong>Scapy Code</strong> — Python Scapy constructors like <code>Ether(dst=...) / IP(...) / TCP(...)</code></li>
            <li><strong>Raw Bytes</strong> — Python <code>b'...'</code> byte literals</li>
          </ul>
          <p><strong>Output formats:</strong> Scapy Python Code, Scapy Python String, Hex, Raw Bytes (Python literal), and Tcpdump hex dump.</p>
          <p>Layers like Ethernet, VLAN, IPv4, IPv6, TCP, UDP, ICMP, ARP, VXLAN, MPLS, and GRE are detected and reconstructed. Multiple packets are supported. File upload is supported (.txt, .log, .py).</p>
          <p>Everything runs in your browser. Nothing is uploaded.</p>
        </div>
      </details>
    </div>
  );
}
