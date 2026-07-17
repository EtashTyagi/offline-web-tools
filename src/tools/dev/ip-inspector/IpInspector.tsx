import { useState } from 'react';
import {
  classifyAddress,
  parseCidr,
  parseIp,
  type Classification,
  type ParsedCidr,
  type ParsedIp,
} from '../ip-address-toolkit/ip';
import {
  CopyButton,
  ErrorBox,
  Field,
  StatGrid,
  ToolShell,
} from '../ip-address-toolkit/ui';

export default function IpInspector() {
  const [input, setInput] = useState('192.168.1.10/24');
  const [error, setError] = useState<string | null>(null);
  const [ip, setIp] = useState<ParsedIp | null>(null);
  const [cidr, setCidr] = useState<ParsedCidr | null>(null);
  const [cls, setCls] = useState<Classification | null>(null);

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

  const summaryText =
    ip && cidr && cls
      ? [
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
        ]
          .filter(Boolean)
          .join('\n')
      : '';

  return (
    <ToolShell
      toolId="ip-inspector"
      hint="All calculations run in your browser. No addresses leave this device."
    >
      <div className="card flex flex-col gap-3">
        <Field
          id="inspect-input"
          label="IP or CIDR"
          value={input}
          onChange={setInput}
          onEnter={run}
          placeholder="192.168.1.10/24 or 2001:db8::1"
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
          <CopyButton text={summaryText} disabled={!ip} />
        </div>
        {error && <ErrorBox message={error} />}
      </div>

      {ip && cls && cidr && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Address</h2>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                IPv{ip.version}
              </span>
            </div>
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
                Classful class {cls.classful} is historical only. Modern routing uses CIDR prefixes,
                not classes.
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
                {
                  label: cidr.version === 4 ? 'Broadcast' : 'Last address',
                  value: cidr.broadcast,
                },
                { label: 'First host', value: cidr.firstHost },
                { label: 'Last host', value: cidr.lastHost },
                { label: 'Total addresses', value: cidr.totalAddresses.toLocaleString() },
                { label: 'Usable hosts', value: cidr.usableHosts.toLocaleString() },
              ]}
            />
          </div>
        </div>
      )}
    </ToolShell>
  );
}
