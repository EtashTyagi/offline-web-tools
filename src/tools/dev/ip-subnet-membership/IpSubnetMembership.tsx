import { useState } from 'react';
import { distance, ipInCidr, sameSubnet } from '../ip-address-toolkit/ip';
import {
  ErrorBox,
  Field,
  SuccessBox,
  ToolShell,
} from '../ip-address-toolkit/ui';

export default function IpSubnetMembership() {
  const [ip, setIp] = useState('10.0.5.20');
  const [cidr, setCidr] = useState('10.0.0.0/16');
  const [a, setA] = useState('192.168.1.10');
  const [b, setB] = useState('192.168.1.50');
  const [prefix, setPrefix] = useState('24');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function checkIn() {
    setError(null);
    try {
      const inside = ipInCidr(ip, cidr);
      setOk(inside);
      setResult(
        inside
          ? `${ip.trim()} is inside ${cidr.trim()}`
          : `${ip.trim()} is NOT inside ${cidr.trim()}`,
      );
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
      setOk(same);
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
    <ToolShell
      toolId="ip-subnet-membership"
      hint="Works for IPv4 and IPv6. Mixed versions are rejected with a clear error."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">IP in subnet?</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ask whether a single address falls inside a CIDR block.
          </p>
          <Field id="contain-ip" label="IP address" value={ip} onChange={setIp} onEnter={checkIn} />
          <Field
            id="contain-cidr"
            label="CIDR"
            value={cidr}
            onChange={setCidr}
            onEnter={checkIn}
            placeholder="10.0.0.0/16"
          />
          <button type="button" onClick={checkIn} className="btn-primary">
            Check membership
          </button>
        </div>
        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Same subnet / distance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compare two addresses under a shared prefix length and show how far apart they are.
          </p>
          <Field id="contain-a" label="Address A" value={a} onChange={setA} onEnter={checkSame} />
          <Field id="contain-b" label="Address B" value={b} onChange={setB} onEnter={checkSame} />
          <Field
            id="contain-prefix"
            label="Prefix length"
            value={prefix}
            onChange={setPrefix}
            onEnter={checkSame}
          />
          <button type="button" onClick={checkSame} className="btn-primary">
            Compare
          </button>
        </div>
      </div>
      {(result || error) && (
        <div>
          {error ? (
            <ErrorBox message={error} />
          ) : result ? (
            ok ? (
              <SuccessBox message={result} />
            ) : (
              <div
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              >
                {result}
              </div>
            )
          ) : null}
        </div>
      )}
    </ToolShell>
  );
}
