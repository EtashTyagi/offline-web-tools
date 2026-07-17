import { useEffect, useRef, useState, type ReactNode } from 'react';
import { trackToolUse } from '../../../lib/track';
import { IP_HUB_PATH, IP_TOOLS } from '../../../lib/ipTools';

export function useTrackOnce(toolId: string) {
  const usedRef = useRef(false);
  useEffect(() => {
    const handler = () => {
      if (usedRef.current) return;
      usedRef.current = true;
      trackToolUse(toolId, 'dev');
    };
    document.addEventListener('input', handler, true);
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('input', handler, true);
      document.removeEventListener('click', handler, true);
    };
  }, [toolId]);
}

export function HubBackLink() {
  return (
    <a
      href={IP_HUB_PATH}
      className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
    >
      <span aria-hidden="true">←</span> All IP tools
    </a>
  );
}

export function RelatedIpTools({ currentId }: { currentId: string }) {
  const others = IP_TOOLS.filter((t) => t.id !== currentId);
  return (
    <nav aria-label="Related IP tools" className="flex flex-wrap gap-2">
      {others.map((t) => (
        <a
          key={t.id}
          href={t.path}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:hover:text-white"
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.name}
        </a>
      ))}
    </nav>
  );
}

export function ToolShell({
  toolId,
  children,
  hint,
}: {
  toolId: string;
  children: ReactNode;
  hint?: string;
}) {
  useTrackOnce(toolId);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <HubBackLink />
        {hint && (
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-right">{hint}</p>
        )}
      </div>
      {children}
      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          More IP tools
        </p>
        <RelatedIpTools currentId={toolId} />
      </div>
    </div>
  );
}

export function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  onEnter,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onEnter?: () => void;
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
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className="input font-mono text-sm"
        spellCheck={false}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}

export function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100 dark:bg-slate-900/40 dark:ring-slate-700/60"
        >
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {it.label}
          </dt>
          <dd className="mt-0.5 break-all font-mono text-sm text-slate-800 dark:text-slate-100">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
    >
      {message}
    </div>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
    >
      {message}
    </div>
  );
}

export function ResultPanel({
  title = 'Result',
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

export function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled || !text}
      className="btn-secondary text-xs disabled:opacity-50"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
