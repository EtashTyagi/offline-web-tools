import { memo, useMemo } from 'react';
import {
  Pie,
  PieChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { formatCurrency } from '../../lib/chart';

export interface TaxStat {
  label: string;
  value: string;
  accent?: 'green' | 'slate' | 'brand';
}

export interface TaxComponent {
  name: string;
  value: number;
}

export interface TaxSlice {
  rate: number; // marginal rate as a fraction for display
  amount: number;
  tax: number;
}

interface Props {
  currency: string;
  yearLabel: string;
  note: string;
  totalTax: number;
  takeHome: number;
  effectiveRate: number; // fraction
  marginalRate?: number; // fraction
  extraStats?: TaxStat[];
  components?: TaxComponent[];
  slices?: TaxSlice[];
  bandHeader?: string; // default "Rate"
  totalsRows?: { label: string; value: number; accent?: 'amber' | 'slate' }[];
}

const PIE_COLORS = ['#6366f1', '#f59e0b', '#16a34a', '#db2777', '#0ea5e9', '#8b5cf6'];

function money(value: number, currency: string): string {
  return formatCurrency(value, currency);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface PiePayload {
  active?: boolean;
  payload?: { payload: TaxComponent }[];
}

function PieTip({ active, payload, currency }: PiePayload & { currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800/95">
      <p className="font-medium text-slate-900 dark:text-white">{d.name}</p>
      <p className="text-slate-600 dark:text-slate-300">{money(d.value, currency)}</p>
    </div>
  );
}

function TaxResultView({
  currency,
  yearLabel,
  note,
  totalTax,
  takeHome,
  effectiveRate,
  marginalRate,
  extraStats,
  components,
  slices,
  bandHeader = 'Rate',
  totalsRows,
}: Props) {
  const pieData = useMemo(
    () =>
      (components ?? [])
        .filter((c) => c.value > 0)
        .map((c, i) => ({ ...c, fill: PIE_COLORS[i % PIE_COLORS.length] })),
    [components],
  );

  const accentMap: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    slate: 'text-slate-900 dark:text-white',
    brand: 'text-slate-900 dark:text-white',
  };
  const rowAccent: Record<string, string> = {
    amber: 'text-amber-600 dark:text-amber-400',
    slate: '',
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">{note}</p>

      <div className="flex flex-col gap-4">
        <div className="card flex flex-col gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{yearLabel} total tax</p>
            <p className="text-4xl font-bold text-brand-600 dark:text-brand-400">
              {money(totalTax, currency)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Take-home</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {money(takeHome, currency)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Effective rate</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {pct(effectiveRate)}
              </p>
            </div>
            {marginalRate !== undefined && (
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">Marginal rate</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {pct(marginalRate)}
                </p>
              </div>
            )}
            {extraStats?.map((s) => (
              <div key={s.label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                <p className={`text-lg font-semibold ${accentMap[s.accent ?? 'slate']}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {pieData.length > 0 && (
          <div className="card">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              Where your tax goes
            </h2>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  />
                  <Tooltip content={<PieTip currency={currency} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {slices && slices.length > 0 && (
        <section aria-label="Tax by band" className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Tax by band
          </h2>
          <div className="max-h-[24rem] overflow-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700/60">
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 font-medium">{bandHeader}</th>
                  <th className="px-3 py-2 text-right font-medium">Amount taxed</th>
                  <th className="px-3 py-2 text-right font-medium">Tax</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-700/60">
                    <td className="px-3 py-2">{Math.round(s.rate * 100)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(s.amount, currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-brand-600 dark:text-brand-400">
                      {money(s.tax, currency)}
                    </td>
                  </tr>
                ))}
                {totalsRows?.map((r) => (
                  <tr
                    key={r.label}
                    className="border-t border-slate-100 dark:border-slate-700/60"
                  >
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2" />
                    <td className={`px-3 py-2 text-right tabular-nums ${rowAccent[r.accent ?? 'slate']}`}>
                      {money(r.value, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default memo(TaxResultView);
