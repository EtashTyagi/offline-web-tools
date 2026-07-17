import { useState } from 'react';
import {
  HOST_LIST_CAP,
  expandCidr,
  randomInCidr,
  rangeToCidrList,
  splitCidr,
  summarizeCidrs,
} from '../ip-address-toolkit/ip';
import {
  CopyButton,
  ErrorBox,
  Field,
  ToolShell,
} from '../ip-address-toolkit/ui';

type Mode = 'expand' | 'split' | 'summarize' | 'range' | 'random';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'expand', label: 'Expand hosts', hint: 'List addresses inside a CIDR (capped for safety).' },
  { id: 'split', label: 'Split subnet', hint: 'Break a prefix into equal smaller subnets.' },
  { id: 'summarize', label: 'Summarize', hint: 'Aggregate a list of CIDRs into fewer prefixes.' },
  { id: 'range', label: 'Range → CIDR', hint: 'Collapse a start–end IP range into CIDR blocks.' },
  { id: 'random', label: 'Random in CIDR', hint: 'Pick one random host inside a prefix.' },
];

export default function SubnetPlanner() {
  const [mode, setMode] = useState<Mode>('expand');
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
        const lines = list
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
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

  const activeHint = MODES.find((m) => m.id === mode)?.hint ?? '';

  return (
    <ToolShell
      toolId="subnet-planner"
      hint="Host expansion is capped so huge prefixes cannot freeze the tab."
    >
      <div className="card flex flex-col gap-4">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Planner modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setError(null);
                setOutput('');
                setMeta('');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                mode === m.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{activeHint}</p>

        {(mode === 'expand' || mode === 'split' || mode === 'random') && (
          <Field
            id="plan-cidr"
            label="CIDR"
            value={cidr}
            onChange={setCidr}
            onEnter={run}
            placeholder="192.168.0.0/24"
          />
        )}
        {mode === 'split' && (
          <Field
            id="plan-new-prefix"
            label="New prefix length"
            value={newPrefix}
            onChange={setNewPrefix}
            onEnter={run}
          />
        )}
        {mode === 'summarize' && (
          <div>
            <label
              htmlFor="plan-list"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="plan-start" label="Start IP" value={start} onChange={setStart} onEnter={run} />
            <Field id="plan-end" label="End IP" value={end} onChange={setEnd} onEnter={run} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={run} className="btn-primary">
            Run
          </button>
          <CopyButton text={output} disabled={!output} />
        </div>
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
    </ToolShell>
  );
}
