import { useState } from 'react';
import {
  decode6to4,
  decodeTeredo,
  encode6to4,
  ipv4ToMapped,
  macToLinkLocal,
  mappedToIpv4,
  netmaskToPrefix,
  prefixToNetmask,
  prefixToWildcard,
} from '../ip-address-toolkit/ip';
import {
  CopyButton,
  ErrorBox,
  Field,
  ToolShell,
} from '../ip-address-toolkit/ui';

export default function IpConverter() {
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
    <ToolShell
      toolId="ip-converter"
      hint="There is no general 1:1 public IPv4↔IPv6 mapping. Only special embeddings apply."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">IPv4-mapped IPv6</h2>
          <Field id="conv-v4" label="IPv4" value={v4} onChange={setV4} />
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => wrap(() => ipv4ToMapped(v4))}
          >
            IPv4 → ::ffff:…
          </button>
          <Field id="conv-mapped" label="IPv4-mapped IPv6" value={mapped} onChange={setMapped} />
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => wrap(() => mappedToIpv4(mapped))}
          >
            ::ffff:… → IPv4
          </button>
        </div>

        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">6to4 &amp; Teredo</h2>
          <Field id="conv-6to4-v4" label="IPv4 for 6to4" value={v4} onChange={setV4} />
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => wrap(() => encode6to4(v4))}
          >
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
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Mask ↔ prefix (IPv4)
          </h2>
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
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            MAC → IPv6 link-local
          </h2>
          <Field id="conv-mac" label="MAC (EUI-48)" value={mac} onChange={setMac} />
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => wrap(() => macToLinkLocal(mac))}
          >
            Generate fe80::…
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Uses modified EUI-64 (insert ff:fe, flip U/L bit) under fe80::/10.
          </p>
        </div>
      </div>

      {(out || error) && (
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Result</h2>
            <CopyButton text={out} disabled={!out} />
          </div>
          {error ? (
            <ErrorBox message={error} />
          ) : (
            <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-xs ring-1 ring-slate-100 dark:bg-slate-900/40 dark:text-slate-100 dark:ring-slate-700/60">
              {out}
            </pre>
          )}
        </div>
      )}
    </ToolShell>
  );
}
