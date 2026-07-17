import { useEffect, useMemo, useRef, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import {
  EXTERNAL_LINKS,
  HOST_LIST_CAP,
  SPECIAL_RANGES,
  batchProcess,
  classifyAddress,
  decode6to4,
  decodeTeredo,
  distance,
  encode6to4,
  expandCidr,
  ipInCidr,
  ipv4ToMapped,
  macToLinkLocal,
  mappedToIpv4,
  netmaskToPrefix,
  parseCidr,
  parseIp,
  prefixToNetmask,
  prefixToWildcard,
  randomInCidr,
  rangeToCidrList,
  sameSubnet,
  splitCidr,
  summarizeCidrs,
  type Classification,
  type ParsedCidr,
  type ParsedIp,
} from './ip';

type Tab = 'inspect' | 'contain' | 'plan' | 'convert' | 'batch' | 'ranges';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'contain', label: 'Containment' },
  { id: 'plan', label: 'Plan' },
  { id: 'convert', label: 'Convert' },
  { id: 'batch', label: 'Batch' },
  { id: 'ranges', label: 'Ranges & links' },
];

export default function IpAddressToolkit() {
  const [tab, setTab] = useState<Tab>('inspect');
  const usedRef = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse('ip-address-toolkit', 'dev');
    };
    document.addEventListener('input', handler, true);
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('input', handler, true);
      document.removeEventListener('click', handler, true);
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="IP toolkit sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                tab === t.id
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 ring-1 ring-slate-300 dark:text-slate-300 dark:ring-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          All calculations run in your browser. No addresses leave this device. WHOIS, geo, and DNS need the network — see Ranges &amp; links.
        </p>
      </div>

      {tab === 'inspect' && <InspectPanel />}
      {tab === 'contain' && <ContainPanel />}
      {tab === 'plan' && <PlanPanel />}
      {tab === 'convert' && <ConvertPanel />}
      {tab === 'batch' && <BatchPanel />}
      {tab === 'ranges' && <RangesPanel />}
    </div>
  );
}

function InspectPanel() {
  const [input, setInput] = useState('192.168.1.10/24');
  const [error, setError] = useState<string | null>(null);
  const [ip, setIp] = useState<ParsedIp | null>(null);
  const [cidr, setCidr] = useState<ParsedCidr | null>(null);
  const [cls, setCls] = useState<Classification | null>(null);
  const [copied, setCopied] = useState(false);

  function run() {
    setError(null);
    setIp(null);
    setCidr(null);
    setCls(null);
    try {
      const raw = input.trim();
      if (!raw) throw new Error('Enter an IP or CIDR.');
      if (raw.includes('/')) {
        const c = parseCidr(raw);
        setCidr(c);
        const p = parseIp(c.network);
        setIp(p);
        setCls(classifyAddress(c.network));
      } else {
        const p = parseIp(raw);
        setIp(p);
        setCls(classifyAddress(p.address));
        setCidr(parseCidr(`${p.address}/${p.version === 4 ? 32 : 128}`));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function loadSample(v: 'v4' | 'v6') {
    setInput(v === 'v4' ? '192.168.1.10/24' : '2001:db8:85a3::8a2e:370:7334/64');
  }

  function copySummary() {
    if (!ip || !cidr || !cls) return;
    const lines = [
      `Address: ${ip.address}`,
      `Expanded: ${ip.expanded}`,
      `Version: IPv${ip.version}`,
      `Classification: ${cls.summary}`,
      `CIDR: ${cidr.cidr}`,
      `Network: ${cidr.network}`,
      `Broadcast/Last: ${cidr.broadcast}`,
      `First host: ${cidr.firstHost}`,
      `Last host: ${cidr.lastHost}`,
      `Netmask: ${cidr.netmask}`,
      cidr.wildcard ? `Wildcard: ${cidr.wildcard}` : '',
      `Total addresses: ${cidr.totalAddresses.toString()}`,
      `Usable hosts: ${cidr.usableHosts.toString()}`,
      `Decimal: ${ip.decimal}`,
      `Hex: ${ip.hex}`,
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3">
        <label htmlFor="inspect-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          IP or CIDR
        </label>
        <input
          id="inspect-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          className="input font-mono"
          placeholder="192.168.1.10/24 or 2001:db8::1"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={run} className="btn-primary" id="inspect-run">
            Analyze
          </button>
          <button type="button" onClick={() => loadSample('v4')} className="btn-secondary text-xs">
            Sample IPv4
          </button>
          <button type="button" onClick={() => loadSample('v6')} className="btn-secondary text-xs">
            Sample IPv6
          </button>
          <button type="button" onClick={copySummary} className="btn-secondary text-xs" disabled={!ip}>
            {copied ? 'Copied' : 'Copy summary'}
          </button>
        </div>
        {error && <ErrorBox message={error} />}
      </div>

      {ip && cls && cidr && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Address</h2>
            <StatGrid
              items={[
                { label: 'Canonical', value: ip.address },
                { label: 'Expanded', value: ip.expanded },
                { label: 'Version', value: `IPv${ip.version}` },
                { label: 'Classification', value: cls.summary },
                { label: 'Decimal', value: ip.decimal },
                { label: 'Hex', value: ip.hex },
                {
                  label: 'Binary',
                  value: ip.binary.replace(/(.{8})/g, '$1 ').trim(),
                },
              ]}
            />
            {cls.classful && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Classful class {cls.classful} is historical only. Modern routing uses CIDR prefixes, not classes.
              </p>
            )}
          </div>
          <div className="card flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Subnet</h2>
            <StatGrid
              items={[
                { label: 'CIDR', value: cidr.cidr },
                { label: 'Network', value: cidr.network },
                { label: 'Prefix', value: String(cidr.prefix) },
                { label: 'Netmask', value: cidr.netmask },
                ...(cidr.wildcard ? [{ label: 'Wildcard', value: cidr.wildcard }] : []),
                { label: cidr.version === 4 ? 'Broadcast' : 'Last address', value: cidr.broadcast },
                { label: 'First host', value: cidr.firstHost },
                { label: 'Last host', value: cidr.lastHost },
                { label: 'Total addresses', value: cidr.totalAddresses.toLocaleString() },
                { label: 'Usable hosts', value: cidr.usableHosts.toLocaleString() },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ContainPanel() {
  const [ip, setIp] = useState('10.0.5.20');
  const [cidr, setCidr] = useState('10.0.0.0/16');
  const [a, setA] = useState('192.168.1.10');
  const [b, setB] = useState('192.168.1.50');
  const [prefix, setPrefix] = useState('24');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function checkIn() {
    setError(null);
    try {
      const inside = ipInCidr(ip, cidr);
      setResult(inside ? `${ip.trim()} is inside ${cidr.trim()}` : `${ip.trim()} is NOT inside ${cidr.trim()}`);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function checkSame() {
    setError(null);
    try {
      const p = parseInt(prefix, 10);
      if (!Number.isFinite(p)) throw new Error('Prefix must be a number.');
      const same = sameSubnet(a, b, p);
      const dist = distance(a, b);
      setResult(
        same
          ? `${a.trim()} and ${b.trim()} share prefix /${p}. Distance: ${dist.toString()} addresses.`
          : `${a.trim()} and ${b.trim()} do NOT share prefix /${p}. Distance: ${dist.toString()} addresses.`,
      );
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">IP in subnet?</h2>
        <Field id="contain-ip" label="IP address" value={ip} onChange={setIp} />
        <Field id="contain-cidr" label="CIDR" value={cidr} onChange={setCidr} />
        <button type="button" onClick={checkIn} className="btn-primary">
          Check membership
        </button>
      </div>
      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Same subnet / distance</h2>
        <Field id="contain-a" label="Address A" value={a} onChange={setA} />
        <Field id="contain-b" label="Address B" value={b} onChange={setB} />
        <Field id="contain-prefix" label="Prefix length" value={prefix} onChange={setPrefix} />
        <button type="button" onClick={checkSame} className="btn-primary">
          Compare
        </button>
      </div>
      {(result || error) && (
        <div className="lg:col-span-2">
          {error ? <ErrorBox message={error} /> : result && <SuccessBox message={result} />}
        </div>
      )}
    </div>
  );
}

function PlanPanel() {
  const [mode, setMode] = useState<'expand' | 'split' | 'summarize' | 'range' | 'random'>('expand');
  const [cidr, setCidr] = useState('192.168.0.0/28');
  const [newPrefix, setNewPrefix] = useState('26');
  const [list, setList] = useState('192.168.0.0/25\n192.168.0.128/25');
  const [start, setStart] = useState('10.0.0.1');
  const [end, setEnd] = useState('10.0.0.20');
  const [output, setOutput] = useState('');
  const [meta, setMeta] = useState('');
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setOutput('');
    setMeta('');
    try {
      if (mode === 'expand') {
        const r = expandCidr(cidr);
        setOutput(r.addresses.join('\n'));
        setMeta(
          r.truncated
            ? `Showing first ${r.addresses.length} of ${r.total.toString()} addresses (cap ${HOST_LIST_CAP}).`
            : `${r.total.toString()} addresses.`,
        );
      } else if (mode === 'split') {
        const p = parseInt(newPrefix, 10);
        if (!Number.isFinite(p)) throw new Error('New prefix must be a number.');
        const r = splitCidr(cidr, p);
        setOutput(r.subnets.join('\n'));
        setMeta(
          r.truncated
            ? `Showing first ${r.subnets.length} of ${r.total.toString()} subnets.`
            : `${r.total.toString()} subnets of /${p}.`,
        );
      } else if (mode === 'summarize') {
        const lines = list.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const r = summarizeCidrs(lines);
        setOutput(r.join('\n'));
        setMeta(`Summarized ${lines.length} input(s) into ${r.length} prefix(es).`);
      } else if (mode === 'range') {
        const r = rangeToCidrList(start, end);
        setOutput(r.join('\n'));
        setMeta(`Range collapsed into ${r.length} CIDR(s).`);
      } else {
        const r = randomInCidr(cidr);
        setOutput(r);
        setMeta(`Random address inside ${cidr.trim()}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['expand', 'Expand hosts'],
              ['split', 'Split subnet'],
              ['summarize', 'Summarize'],
              ['range', 'Range → CIDR'],
              ['random', 'Random in CIDR'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                mode === id
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 ring-1 ring-slate-300 dark:text-slate-300 dark:ring-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(mode === 'expand' || mode === 'split' || mode === 'random') && (
          <Field id="plan-cidr" label="CIDR" value={cidr} onChange={setCidr} />
        )}
        {mode === 'split' && (
          <Field id="plan-new-prefix" label="New prefix length" value={newPrefix} onChange={setNewPrefix} />
        )}
        {mode === 'summarize' && (
          <div>
            <label htmlFor="plan-list" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              CIDRs (one per line)
            </label>
            <textarea
              id="plan-list"
              value={list}
              onChange={(e) => setList(e.target.value)}
              className="input h-28 font-mono text-xs"
              spellCheck={false}
            />
          </div>
        )}
        {mode === 'range' && (
          <>
            <Field id="plan-start" label="Start IP" value={start} onChange={setStart} />
            <Field id="plan-end" label="End IP" value={end} onChange={setEnd} />
          </>
        )}
        <button type="button" onClick={run} className="btn-primary">
          Run
        </button>
        {error && <ErrorBox message={error} />}
        {meta && <p className="text-xs text-slate-500 dark:text-slate-400">{meta}</p>}
        {output && (
          <textarea
            readOnly
            value={output}
            className="input h-56 font-mono text-xs"
            aria-label="Plan output"
          />
        )}
      </div>
    </div>
  );
}

function ConvertPanel() {
  const [v4, setV4] = useState('192.0.2.10');
  const [mapped, setMapped] = useState('::ffff:192.0.2.10');
  const [sixTo4, setSixTo4] = useState('2002:c000:020a::');
  const [teredo, setTeredo] = useState('2001:0:4136:e378:8000:63bf:3fff:fdd2');
  const [maskIn, setMaskIn] = useState('255.255.255.0');
  const [prefixIn, setPrefixIn] = useState('24');
  const [mac, setMac] = useState('00:1a:2b:3c:4d:5e');
  const [out, setOut] = useState('');
  const [error, setError] = useState<string | null>(null);

  function wrap(fn: () => string) {
    setError(null);
    try {
      setOut(fn());
    } catch (e) {
      setOut('');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">IPv4-mapped IPv6</h2>
        <Field id="conv-v4" label="IPv4" value={v4} onChange={setV4} />
        <button type="button" className="btn-secondary text-sm" onClick={() => wrap(() => ipv4ToMapped(v4))}>
          IPv4 → ::ffff:…
        </button>
        <Field id="conv-mapped" label="IPv4-mapped IPv6" value={mapped} onChange={setMapped} />
        <button type="button" className="btn-secondary text-sm" onClick={() => wrap(() => mappedToIpv4(mapped))}>
          ::ffff:… → IPv4
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          There is no general 1:1 conversion between arbitrary public IPv4 and IPv6. Only special embeddings (mapped, 6to4, Teredo) apply.
        </p>
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">6to4 &amp; Teredo</h2>
        <Field id="conv-6to4-v4" label="IPv4 for 6to4" value={v4} onChange={setV4} />
        <button type="button" className="btn-secondary text-sm" onClick={() => wrap(() => encode6to4(v4))}>
          IPv4 → 6to4
        </button>
        <Field id="conv-6to4" label="6to4 IPv6" value={sixTo4} onChange={setSixTo4} />
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() =>
            wrap(() => {
              const d = decode6to4(sixTo4);
              return `IPv4: ${d.ipv4}\nPrefix: ${d.prefix}`;
            })
          }
        >
          Decode 6to4
        </button>
        <Field id="conv-teredo" label="Teredo IPv6" value={teredo} onChange={setTeredo} />
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() =>
            wrap(() => {
              const d = decodeTeredo(teredo);
              return `Server: ${d.serverIpv4}\nClient: ${d.clientIpv4}\nUDP port: ${d.udpPort}\nFlags: 0x${d.flags.toString(16)}`;
            })
          }
        >
          Decode Teredo
        </button>
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Mask ↔ prefix (IPv4)</h2>
        <Field id="conv-mask" label="Dotted netmask" value={maskIn} onChange={setMaskIn} />
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => wrap(() => `/${netmaskToPrefix(maskIn)}`)}
        >
          Netmask → prefix
        </button>
        <Field id="conv-prefix" label="Prefix length" value={prefixIn} onChange={setPrefixIn} />
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() =>
            wrap(() => {
              const p = parseInt(prefixIn, 10);
              if (!Number.isFinite(p)) throw new Error('Prefix must be a number.');
              return `Netmask: ${prefixToNetmask(4, p)}\nWildcard: ${prefixToWildcard(p)}`;
            })
          }
        >
          Prefix → netmask &amp; wildcard
        </button>
      </div>

      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">MAC → IPv6 link-local</h2>
        <Field id="conv-mac" label="MAC (EUI-48)" value={mac} onChange={setMac} />
        <button type="button" className="btn-secondary text-sm" onClick={() => wrap(() => macToLinkLocal(mac))}>
          Generate fe80::…
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Uses modified EUI-64 (insert ff:fe, flip U/L bit) under fe80::/10.
        </p>
      </div>

      {(out || error) && (
        <div className="lg:col-span-2 card">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Result</h2>
          {error ? <ErrorBox message={error} /> : (
            <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-xs dark:bg-slate-800 dark:text-slate-100">
              {out}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function BatchPanel() {
  const [text, setText] = useState('192.168.1.1\n10.0.0.5\n2001:db8::1\nnot-an-ip\n8.8.8.8');
  const [checkCidr, setCheckCidr] = useState('10.0.0.0/8');
  const [useCheck, setUseCheck] = useState(true);
  const [rows, setRows] = useState<ReturnType<typeof batchProcess>>([]);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    try {
      setRows(batchProcess(text, useCheck && checkCidr.trim() ? { checkCidr } : {}));
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const ok = rows.filter((r) => r.ok).length;
    return `${ok}/${rows.length} valid`;
  }, [rows]);

  return (
    <div className="card flex flex-col gap-3">
      <label htmlFor="batch-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Addresses (one per line)
      </label>
      <textarea
        id="batch-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input h-36 font-mono text-xs"
        spellCheck={false}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={useCheck}
            onChange={(e) => setUseCheck(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Check against CIDR
        </label>
        <div className="min-w-[12rem] flex-1">
          <Field id="batch-cidr" label="CIDR" value={checkCidr} onChange={setCheckCidr} />
        </div>
        <button type="button" onClick={run} className="btn-primary">
          Process batch
        </button>
      </div>
      {error && <ErrorBox message={error} />}
      {summary && <p className="text-xs text-slate-500 dark:text-slate-400">{summary}</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-2 pr-2">Input</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Version</th>
                <th className="py-2 pr-2">Classification</th>
                {useCheck && <th className="py-2 pr-2">In CIDR</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 pr-2 font-mono">{r.line}</td>
                  <td className="py-1.5 pr-2">
                    {r.ok ? (
                      <span className="text-emerald-600 dark:text-emerald-400">ok</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">{r.error}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">{r.version ? `IPv${r.version}` : '—'}</td>
                  <td className="py-1.5 pr-2">{r.classification?.summary ?? '—'}</td>
                  {useCheck && (
                    <td className="py-1.5 pr-2">
                      {r.inCidr === undefined ? '—' : r.inCidr ? 'yes' : 'no'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RangesPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Special ranges (offline)</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Common reserved blocks baked into the tool. Use Inspect or Containment to test membership.
        </p>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                <th className="py-2 pr-2">CIDR</th>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {SPECIAL_RANGES.map((r) => (
                <tr key={r.cidr} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 pr-2 font-mono whitespace-nowrap">{r.cidr}</td>
                  <td className="py-1.5 pr-2">{r.name}</td>
                  <td className="py-1.5 pr-2 text-slate-500 dark:text-slate-400">
                    {r.rfc ? `${r.rfc} · ` : ''}
                    {r.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">External lookups</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          These need the network and are intentionally not built into this offline tool. Open them in a new tab with your address.
        </p>
        <ul className="space-y-3">
          {EXTERNAL_LINKS.map((l) => (
            <li key={l.url} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {l.name}
              </a>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{l.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input font-mono text-sm"
        spellCheck={false}
      />
    </div>
  );
}

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{it.label}</dt>
          <dd className="break-all font-mono text-sm text-slate-800 dark:text-slate-100">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
    >
      {message}
    </div>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
      {message}
    </div>
  );
}
