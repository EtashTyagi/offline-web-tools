import { useMemo, useState } from 'react';
import { batchProcess } from '../ip-address-toolkit/ip';
import {
  ErrorBox,
  Field,
  ToolShell,
} from '../ip-address-toolkit/ui';

export default function IpBatchValidator() {
  const [text, setText] = useState(
    '192.168.1.1\n10.0.0.5\n2001:db8::1\nnot-an-ip\n8.8.8.8',
  );
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
    <ToolShell
      toolId="ip-batch-validator"
      hint="One address per line. Blank lines are skipped. Optional CIDR check is offline only."
    >
      <div className="card flex flex-col gap-3">
        <label
          htmlFor="batch-input"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
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
            <Field
              id="batch-cidr"
              label="CIDR"
              value={checkCidr}
              onChange={setCheckCidr}
              onEnter={run}
            />
          </div>
          <button type="button" onClick={run} className="btn-primary">
            Process batch
          </button>
        </div>
        {error && <ErrorBox message={error} />}
        {summary && (
          <p className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {summary}
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                  <th className="px-3 py-2 pr-2 font-medium">Input</th>
                  <th className="px-3 py-2 pr-2 font-medium">Status</th>
                  <th className="px-3 py-2 pr-2 font-medium">Version</th>
                  <th className="px-3 py-2 pr-2 font-medium">Classification</th>
                  {useCheck && <th className="px-3 py-2 pr-2 font-medium">In CIDR</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-3 py-1.5 pr-2 font-mono">{r.line}</td>
                    <td className="px-3 py-1.5 pr-2">
                      {r.ok ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          ok
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">{r.error}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 pr-2">{r.version ? `IPv${r.version}` : '—'}</td>
                    <td className="px-3 py-1.5 pr-2">{r.classification?.summary ?? '—'}</td>
                    {useCheck && (
                      <td className="px-3 py-1.5 pr-2">
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
    </ToolShell>
  );
}
