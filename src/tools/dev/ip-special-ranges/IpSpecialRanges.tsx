import { useMemo, useState } from 'react';
import { EXTERNAL_LINKS, SPECIAL_RANGES } from '../ip-address-toolkit/ip';
import { ToolShell } from '../ip-address-toolkit/ui';

export default function IpSpecialRanges() {
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState<'all' | '4' | '6'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPECIAL_RANGES.filter((r) => {
      if (version === '4' && r.cidr.includes(':')) return false;
      if (version === '6' && !r.cidr.includes(':')) return false;
      if (!q) return true;
      return (
        r.cidr.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.rfc?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, version]);

  return (
    <ToolShell
      toolId="ip-special-ranges"
      hint="Reserved blocks are baked in offline. WHOIS, geo, and DNS need the network."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Special ranges (offline)
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} shown
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by CIDR, name, RFC…"
              className="input min-w-[12rem] flex-1 text-sm"
              aria-label="Filter special ranges"
            />
            <div className="flex gap-1" role="group" aria-label="IP version filter">
              {(
                [
                  ['all', 'All'],
                  ['4', 'IPv4'],
                  ['6', 'IPv6'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVersion(id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    version === id
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 ring-1 ring-slate-300 dark:text-slate-300 dark:ring-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use{' '}
            <a
              href="/tools/dev/ip-inspector"
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              IP Inspector
            </a>{' '}
            or{' '}
            <a
              href="/tools/dev/ip-subnet-membership"
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Subnet Membership
            </a>{' '}
            to test an address against these blocks.
          </p>
          <div className="max-h-96 overflow-y-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="px-3 py-2 pr-2 font-medium">CIDR</th>
                  <th className="px-3 py-2 pr-2 font-medium">Name</th>
                  <th className="px-3 py-2 pr-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.cidr}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-3 py-1.5 pr-2 font-mono whitespace-nowrap">{r.cidr}</td>
                    <td className="px-3 py-1.5 pr-2">{r.name}</td>
                    <td className="px-3 py-1.5 pr-2 text-slate-500 dark:text-slate-400">
                      {r.rfc ? `${r.rfc} · ` : ''}
                      {r.description}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                      No ranges match that filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">External lookups</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            These need the network and are intentionally not built into this offline tool. Open
            them in a new tab with your address.
          </p>
          <ul className="space-y-3">
            {EXTERNAL_LINKS.map((l) => (
              <li
                key={l.url}
                className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100 transition hover:ring-brand-300 dark:bg-slate-900/40 dark:ring-slate-700/60 dark:hover:ring-brand-600"
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {l.name}
                  <span className="ml-1 text-xs text-slate-400" aria-hidden="true">
                    ↗
                  </span>
                </a>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{l.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ToolShell>
  );
}
