import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  parsePcapFile,
  buildStats,
  buildConversations,
  buildTopology,
  formatBytes,
  formatDuration,
  type PcapPacket,
  type PcapLayer,
  type PcapFileResult,
  type Conversation,
} from './pcap';
import { trackToolUse } from '../../../lib/track';
import { useIsDark } from '../../../lib/chart';

interface LoadedPacket extends PcapPacket {
  fileName: string;
}

interface FileSummary {
  name: string;
  format: string;
  linkType: number;
  packetCount: number;
  error?: string;
}

const TABLE_PAGE = 200;
const FLOW_PAGE = 200;

function formatTime(ns: number, first: number): string {
  const rel = (ns - first) / 1e6;
  return `${rel.toFixed(3)}s`;
}

function layerBars(layers: PcapLayer[]): string {
  return layers
    .map((l) => `<span style="display:inline-block;width:22px;height:10px;background:${l.color};border-radius:2px;margin-right:1px" title="${l.name}"></span>`)
    .join('');
}

export default function PcapAnalyzer() {
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [packets, setPackets] = useState<LoadedPacket[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeFile, setActiveFile] = useState<string>('all');
  const [protoFilter, setProtoFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [showFields, setShowFields] = useState(false);

  const [selectedPacket, setSelectedPacket] = useState<number | null>(null);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(TABLE_PAGE);
  const [visibleFlow, setVisibleFlow] = useState(FLOW_PAGE);

  const workerRef = useRef<Worker | null>(null);
  const usedRef = useRef(false);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./pcap.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e: MessageEvent) => {
      const { results } = e.data as { results: PcapFileResult[] };
      handleResults(results);
    };
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('pcap-analyzer', 'dev');
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  function handleResults(results: PcapFileResult[]) {
    const summaries: FileSummary[] = [];
    const all: LoadedPacket[] = [];
    let global = 0;
    for (const r of results) {
      summaries.push({ name: r.name, format: r.format, linkType: r.linkType, packetCount: r.packetCount, error: r.error });
      for (const p of r.packets) all.push({ ...p, index: global++, fileName: r.name });
    }
    setFiles(summaries);
    setPackets(all);
    setParsing(false);
    setVisibleRows(TABLE_PAGE);
    setError(summaries.some((s) => s.error) ? 'Some files could not be fully parsed (see file list).' : null);
    const protos = new Set(all.map((p) => p.protocols[p.protocols.length - 1] ?? 'Raw'));
    setProtoFilter(protos);
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setParsing(true);
    setError(null);
    const entries = Array.from(list);
    Promise.all(entries.map((f) => f.arrayBuffer().then((b) => ({ name: f.name, bytes: new Uint8Array(b) }))))
      .then((inputs) => {
        const worker = workerRef.current;
        if (!worker) {
          // Fallback: parse on main thread.
          handleResults(inputs.map((i) => parsePcapFile(i.name, i.bytes)));
          return;
        }
        worker.postMessage({ files: inputs });
      })
      .catch((err) => {
        setParsing(false);
        setError(err instanceof Error ? err.message : String(err));
      });
  }

  function loadSample() {
    setParsing(true);
    const bytes = samplePcapBytes();
    const r = parsePcapFile('sample.pcap', bytes);
    handleResults([r]);
  }

  // Precompute a lowercase searchable haystack per packet once, so filtering
  // does not rebuild it on every keystroke.
  const haystack = useMemo(
    () =>
      packets.map((p) =>
        `${p.info} ${p.fileName} ${p.layers.map((l) => `${l.fields.src ?? ''} ${l.fields.dst ?? ''} ${l.summary}`).join(' ')}`.toLowerCase(),
      ),
    [packets],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: LoadedPacket[] = [];
    for (let i = 0; i < packets.length; i++) {
      const p = packets[i];
      if (activeFile !== 'all' && p.fileName !== activeFile) continue;
      const top = p.protocols[p.protocols.length - 1] ?? 'Raw';
      if (protoFilter.size > 0 && !protoFilter.has(top)) continue;
      if (q && !haystack[i].includes(q)) continue;
      out.push(p);
    }
    return out;
  }, [packets, haystack, activeFile, protoFilter, search]);

  const stats = useMemo(() => buildStats(filtered), [filtered]);
  const conversations = useMemo(() => buildConversations(filtered), [filtered]);
  const topology = useMemo(() => buildTopology(conversations), [conversations]);

  const protoChartData = useMemo(
    () => stats.protocolList.map((p) => ({ name: p, packets: stats.byProto[p], bytes: stats.byProtoBytes[p] })),
    [stats],
  );

  // O(1) lookups by packet index, memoized on the packet set.
  const packetMap = useMemo(() => {
    const m = new Map<number, LoadedPacket>();
    for (const p of packets) m.set(p.index, p);
    return m;
  }, [packets]);

  const conv = selectedConv ? conversations.find((c) => c.key === selectedConv) : null;
  const convPackets = useMemo(
    () => (conv ? conv.packets.map((i) => packetMap.get(i)).filter((p): p is LoadedPacket => !!p) : []),
    [conv, packetMap],
  );
  useEffect(() => { setVisibleFlow(FLOW_PAGE); }, [selectedConv]);
  const shownFlow = convPackets.slice(0, visibleFlow);
  const selPacket = selectedPacket != null ? packetMap.get(selectedPacket) ?? null : null;

  const allProtos = useMemo(() => [...new Set(packets.map((p) => p.protocols[p.protocols.length - 1] ?? 'Raw'))].sort(), [packets]);
  const shownRows = filtered.slice(0, visibleRows);

  function toggleProto(p: string) {
    setProtoFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Upload */}
      <div className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-primary cursor-pointer text-sm">
            Load .pcap / .pcapng
            <input type="file" className="hidden" onChange={onFiles} accept=".pcap,.pcapng,.cap,application/octet-stream" multiple />
          </label>
          <button type="button" onClick={loadSample} className="btn-secondary text-sm">Load sample</button>
          {parsing && <span className="text-sm text-slate-500 dark:text-slate-400">Parsing…</span>}
          {packets.length > 0 && (
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {packets.length} packet(s) in {files.length} file(s)
            </span>
          )}
        </div>
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {error}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveFile('all')}
              className={`rounded-full px-3 py-1 text-xs ${activeFile === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}
            >
              All files
            </button>
            {files.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setActiveFile(f.name)}
                title={f.error ?? ''}
                className={`rounded-full px-3 py-1 text-xs ${activeFile === f.name ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}
              >
                {f.name} · {f.packetCount}
                {f.error && ' ⚠'}
              </button>
            ))}
          </div>
        )}
      </div>

      {packets.length === 0 && !parsing && (
        <div className="card text-sm text-slate-500 dark:text-slate-400">
          Load one or more pcap/pcapng files (or the sample) to inspect packets, statistics, conversations, and the network topology. Everything is parsed locally in your browser.
        </div>
      )}

      {packets.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card"><p className="text-xs text-slate-500 dark:text-slate-400">Packets</p><p className="text-2xl font-bold">{stats.packetCount}</p></div>
            <div className="card"><p className="text-xs text-slate-500 dark:text-slate-400">Total bytes</p><p className="text-2xl font-bold">{formatBytes(stats.totalBytes)}</p></div>
            <div className="card"><p className="text-xs text-slate-500 dark:text-slate-400">Duration</p><p className="text-2xl font-bold">{formatDuration(stats.durationNs)}</p></div>
            <div className="card"><p className="text-xs text-slate-500 dark:text-slate-400">Endpoints</p><p className="text-2xl font-bold">{topology.nodes.length}</p></div>
          </div>

          {/* Filters */}
          <div className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by IP, port, or info…"
                className="input max-w-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-300">Protocols:</span>
              {allProtos.map((p) => (
                <label key={p} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-700">
                  <input type="checkbox" checked={protoFilter.has(p)} onChange={() => toggleProto(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Protocol chart */}
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Packets by protocol</h2>
              <div className="h-56">
                <ProtocolChart data={protoChartData} />
              </div>
            </div>

            {/* Top talkers */}
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Top talkers</h2>
              {stats.topTalkers.length === 0 ? (
                <p className="text-xs text-slate-400">No IP endpoints found.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {stats.topTalkers.map((t) => (
                    <li key={t.ip} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="font-mono text-slate-700 dark:text-slate-200">{t.ip}</span>
                      <span className="text-slate-500 dark:text-slate-400">{formatBytes(t.bytes)} · {t.packets} pkt</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Topology */}
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Network topology</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Click an edge to trace that conversation's packet flow.</p>
            </div>
            <TopologyGraph
              topology={topology}
              conversations={conversations}
              selected={conv}
              onSelect={(key) => setSelectedConv(key)}
            />
          </div>

          {/* Conversations + flow */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Conversations ({conversations.length})</h2>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                {conversations.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedConv(c.key)}
                      className={`w-full px-2 py-1.5 text-left text-xs ${selectedConv === c.key ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}
                    >
                      <span className="font-mono text-slate-700 dark:text-slate-200">{c.src} → {c.dst}</span>
                      <span className="ml-2 text-slate-500 dark:text-slate-400">{c.proto} {c.sport ?? ''}:{c.dport ?? ''}</span>
                      <span className="float-right text-slate-500 dark:text-slate-400">{formatBytes(c.bytes)} · {c.packets.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                Packet flow {conv ? `(${conv.src} → ${conv.dst})` : ''}
              </h2>
              {!conv ? (
                <p className="text-xs text-slate-400">Select a conversation or topology edge to trace its packet flow.</p>
              ) : (
                <ol className="max-h-72 space-y-1 overflow-y-auto text-xs">
                  {shownFlow.map((p) => (
                    <li key={p.index} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <span className="w-16 text-slate-400">{formatTime(p.tsNs, stats.firstTsNs)}</span>
                      <span className="font-mono">{p.protocols.join('/')}</span>
                      <span className="flex-1 text-slate-600 dark:text-slate-300">{p.info}</span>
                      <button type="button" onClick={() => setSelectedPacket(p.index)} className="text-brand-600 dark:text-brand-400">inspect</button>
                    </li>
                  ))}
                </ol>
              )}
              {conv && visibleFlow < convPackets.length && (
                <button type="button" onClick={() => setVisibleFlow((v) => v + FLOW_PAGE)} className="btn-secondary mt-2 text-xs">
                  Show more ({convPackets.length - visibleFlow} remaining)
                </button>
              )}
            </div>
          </div>

          {/* Packet table */}
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Packets ({filtered.length})</h2>
              <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={showFields} onChange={(e) => setShowFields(e.target.checked)} />
                Show layer fields
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Time</th>
                    <th className="py-1 pr-2">Layers</th>
                    <th className="py-1 pr-2">Source</th>
                    <th className="py-1 pr-2">Destination</th>
                    <th className="py-1 pr-2">Proto</th>
                    <th className="py-1 pr-2">Info</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((p) => (
                    <tr
                      key={p.index}
                      onClick={() => setSelectedPacket(p.index)}
                      className={`cursor-pointer border-t border-slate-100 dark:border-slate-700 ${selectedPacket === p.index ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}
                    >
                      <td className="py-1 pr-2 text-slate-400">{p.index}</td>
                      <td className="py-1 pr-2 text-slate-500">{formatTime(p.tsNs, stats.firstTsNs)}</td>
                      <td className="py-1 pr-2" dangerouslySetInnerHTML={{ __html: layerBars(p.layers) }} />
                      <td className="py-1 pr-2 font-mono text-slate-700 dark:text-slate-200">{srcOf(p)}</td>
                      <td className="py-1 pr-2 font-mono text-slate-700 dark:text-slate-200">{dstOf(p)}</td>
                      <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">{p.protocols[p.protocols.length - 1]}</td>
                      <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">{p.info}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleRows < filtered.length && (
              <button type="button" onClick={() => setVisibleRows((v) => v + TABLE_PAGE)} className="btn-secondary mt-3 text-xs">
                Show more ({filtered.length - visibleRows} remaining)
              </button>
            )}
          </div>

          {/* Packet detail */}
          {selPacket && (
            <div className="card">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Packet #{selPacket.index} detail</h2>
                <button type="button" onClick={() => setSelectedPacket(null)} className="text-xs text-slate-500 hover:text-brand-600">close</button>
              </div>
              <div className="flex flex-col gap-2">
                {selPacket.layers.map((l, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded" style={{ background: l.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{l.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">offset {l.offset}, length {l.length}</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">{l.summary}</p>
                    {showFields && Object.keys(l.fields).length > 0 && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
                        {Object.entries(l.fields).map(([k, v]) => (
                          <div key={k}><dt className="inline text-slate-400">{k}: </dt><dd className="inline font-mono text-slate-700 dark:text-slate-200">{v}</dd></div>
                        ))}
                      </dl>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function srcOf(p: PcapPacket): string {
  const ip = p.layers.find((l) => l.fields.src);
  const l4 = p.layers.find((l) => l.name === 'TCP' || l.name === 'UDP');
  const port = l4?.fields.sport ? `:${l4.fields.sport}` : '';
  return (ip?.fields.src ?? '') + port;
}
function dstOf(p: PcapPacket): string {
  const ip = p.layers.find((l) => l.fields.dst);
  const l4 = p.layers.find((l) => l.name === 'TCP' || l.name === 'UDP');
  const port = l4?.fields.dport ? `:${l4.fields.dport}` : '';
  return (ip?.fields.dst ?? '') + port;
}

interface ProtoDatum {
  name: string;
  packets: number;
  bytes: number;
}

interface ProtoTooltipPayload {
  active?: boolean;
  payload?: { payload: ProtoDatum; name: string; value: number; color: string }[];
  label?: string;
}

function ProtoChartTooltip({ active, payload }: ProtoTooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
      <p className="mb-1 font-semibold text-slate-900 dark:text-white">{d.name}</p>
      <p className="text-slate-600 dark:text-slate-300">
        Packets: <span className="font-medium">{d.packets}</span>
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        Bytes: <span className="font-medium">{formatBytes(d.bytes)}</span>
      </p>
    </div>
  );
}

function ProtocolChart({ data }: { data: ProtoDatum[] }) {
  const dark = useIsDark();
  const axisColor = dark ? '#94a3b8' : '#64748b';
  const gridColor = dark ? '#334155' : '#e2e8f0';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} stroke={axisColor} />
        <YAxis tick={{ fill: axisColor, fontSize: 11 }} stroke={axisColor} />
        <Tooltip content={<ProtoChartTooltip />} cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} />
        <Bar dataKey="packets" fill="#6366f1" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TopologyGraphProps {
  topology: ReturnType<typeof buildTopology>;
  conversations: Conversation[];
  selected: Conversation | null | undefined;
  onSelect: (key: string) => void;
}

function TopologyGraph({ topology, conversations, selected, onSelect }: TopologyGraphProps) {
  const W = 640;
  const H = 360;
  const nodes = topology.nodes;
  if (nodes.length === 0) {
    return <p className="text-xs text-slate-400">No IP endpoints to graph.</p>;
  }
  // Circular layout.
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 40;
  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const ang = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(n.id, { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  });
  const maxBytes = topology.edges.reduce((m, e) => (e.bytes > m ? e.bytes : m), 1);

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block" role="img" aria-label="Network topology graph">
        {topology.edges.map((e, i) => {
          const a = pos.get(e.a)!;
          const b = pos.get(e.b)!;
          const active = selected && ((selected.src === e.a && selected.dst === e.b) || (selected.src === e.b && selected.dst === e.a));
          const sw = 1 + (e.bytes / maxBytes) * 6;
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={active ? '#6366f1' : '#cbd5e1'}
              strokeWidth={active ? sw + 2 : sw}
              className="cursor-pointer"
              onClick={() => onSelect(resolveConvKey(conversations, e.a, e.b))}
            >
              <title>{`${e.a} ↔ ${e.b} · ${e.proto} · ${formatBytes(e.bytes)}`}</title>
            </line>
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const isSel = selected && (selected.src === n.id || selected.dst === n.id);
          return (
            <g key={n.id} className="cursor-pointer" onClick={() => {}}>
              <circle cx={p.x} cy={p.y} r={isSel ? 9 : 7} fill={isSel ? '#6366f1' : '#3b82f6'} />
              <text x={p.x} y={p.y - 12} textAnchor="middle" className="fill-slate-700 text-[9px] dark:fill-slate-200" style={{ fontSize: 9 }}>
                {n.label}
              </text>
              <title>{`${n.id} · ${formatBytes(n.bytes)} · ${n.packets} pkt`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function resolveConvKey(conversations: Conversation[], a: string, b: string): string {
  // The topology edge is undirected; pick the heaviest directional
  // conversation that matches either orientation of this endpoint pair.
  const matches = conversations.filter((c) => (c.src === a && c.dst === b) || (c.src === b && c.dst === a));
  if (matches.length === 0) return '';
  return matches.sort((x, y) => y.bytes - x.bytes)[0].key;
}

// A small synthetic pcap with an Ethernet/IPv4/TCP SYN and an ARP request,
// used by the "Load sample" button so the tool is explorable without a file.
function samplePcapBytes(): Uint8Array {
  // Ethernet/IPv4/TCP SYN packet.
  const syn = hexToBytes(
    'aabbccddeeff 112233445566 0800' +
    '4500003c0001400040060000 0a000001 0a000002' +
    '01bb138800000001000000005002200000000000',
  );
  // Ethernet/ARP request.
  const arp = hexToBytes(
    'ffffffffffff 112233445566 0806' +
    '0001080006040001 112233445566 0a000001 000000000000 0a000002',
  );
  const out: number[] = [];
  // Global header: magic a1b2c3d4, v2.4, tz0, sigfigs0, snaplen 65535, linktype 1.
  pushU32be(out, 0xa1b2c3d4);
  pushU16be(out, 2);
  pushU16be(out, 4);
  pushU32be(out, 0);
  pushU32be(out, 0);
  pushU32be(out, 65535);
  pushU32be(out, 1);
  pushRecord(out, 1, 0, syn);
  pushRecord(out, 2, 0, arp);
  return new Uint8Array(out);
}

function pushU32be(arr: number[], v: number) { arr.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
function pushU16be(arr: number[], v: number) { arr.push((v >>> 8) & 255, v & 255); }
function pushRecord(arr: number[], sec: number, frac: number, data: Uint8Array) {
  pushU32be(arr, sec);
  pushU32be(arr, frac);
  pushU32be(arr, data.length);
  pushU32be(arr, data.length);
  for (const b of data) arr.push(b);
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  return out;
}
