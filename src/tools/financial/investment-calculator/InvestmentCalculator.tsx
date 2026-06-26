import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { trackToolUse } from '../../../lib/track';

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'CAD', label: 'Canadian Dollar (C$)' },
  { code: 'CNY', label: 'Chinese Yuan (¥)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'ZAR', label: 'South African Rand (R)' },
];

export const FREQUENCIES = [
  { freq: 12, label: 'Monthly' },
  { freq: 4, label: 'Quarterly' },
  { freq: 2, label: 'Semiannual' },
  { freq: 1, label: 'Annual' },
];

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function compactCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${value.toFixed(0)}`;
  }
}

export interface Contribution {
  amount: number;
  freq: number;
}

export interface InvRow {
  period: number;
  contribution: number;
  interest: number;
  balance: number;
  cumContribution: number;
  cumInterest: number;
}

export interface InvResult {
  finalBalance: number;
  totalLump: number;
  totalContributions: number;
  totalInterest: number;
  rows: InvRow[];
}

export function computeInvestment(
  lumpSum: number,
  annualRate: number,
  years: number,
  contributions: Contribution[],
): InvResult {
  const monthlyRate = annualRate / 100 / 12;
  const months = Math.round(years * 12);
  const streams = contributions
    .filter((c) => Number.isFinite(c.amount) && c.amount > 0 && Number.isFinite(c.freq) && c.freq > 0)
    .map((c) => ({ amount: c.amount, step: Math.max(1, Math.round(12 / c.freq)) }));

  const rows: InvRow[] = [];
  let balance = lumpSum;
  let cumContribution = 0;
  let cumInterest = 0;

  for (let m = 1; m <= months; m++) {
    const interest = balance * monthlyRate;
    balance += interest;
    let contribution = 0;
    for (const s of streams) {
      if (m % s.step === 0) contribution += s.amount;
    }
    balance += contribution;
    cumContribution += contribution;
    cumInterest += interest;
    rows.push({
      period: m,
      contribution,
      interest,
      balance,
      cumContribution,
      cumInterest,
    });
  }

  const totalLump = lumpSum;
  const totalContributions = totalLump + cumContribution;
  return {
    finalBalance: balance,
    totalLump,
    totalContributions,
    totalInterest: balance - totalContributions,
    rows,
  };
}

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const get = () => document.documentElement.classList.contains('dark');
    setDark(get());
    const observer = new MutationObserver(() => setDark(get()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

interface ChartDatum {
  period: number;
  year: number;
  month: number;
  balance: number;
  cumContribution: number;
  cumInterest: number;
}

interface TooltipPayload {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
}

function ChartTooltip({ active, payload, currency }: TooltipPayload & { currency: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
      <p className="mb-1 font-semibold text-slate-900 dark:text-white">
        Year {datum.year}, Month {datum.month}
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        Balance: <span className="font-medium">{formatCurrency(datum.balance, currency)}</span>
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        Contributions: <span className="font-medium">{formatCurrency(datum.cumContribution, currency)}</span>
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        Interest earned: <span className="font-medium">{formatCurrency(datum.cumInterest, currency)}</span>
      </p>
    </div>
  );
}

function GrowthChart({ rows, currency }: { rows: InvRow[]; currency: string }) {
  const dark = useIsDark();
  const data = useMemo<ChartDatum[]>(
    () =>
      rows.map((r) => ({
        period: r.period,
        year: Math.ceil(r.period / 12),
        month: ((r.period - 1) % 12) + 1,
        balance: r.balance,
        cumContribution: r.cumContribution,
        cumInterest: r.cumInterest,
      })),
    [rows],
  );

  if (data.length === 0) return null;

  const axisColor = dark ? '#94a3b8' : '#64748b';
  const gridColor = dark ? '#334155' : '#e2e8f0';

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="gradContrib" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradInterest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year"
            type="number"
            domain={[1, data[data.length - 1].year]}
            tickFormatter={(v: number) => `Yr ${v}`}
            tick={{ fill: axisColor, fontSize: 12 }}
            stroke={axisColor}
            allowDecimals={false}
          />
          <YAxis
            tickFormatter={(v: number) => compactCurrency(v, currency)}
            tick={{ fill: axisColor, fontSize: 12 }}
            stroke={axisColor}
            width={70}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="cumContribution"
            name="Contributions"
            stackId="stack"
            stroke="#6366f1"
            strokeWidth={1.5}
            fill="url(#gradContrib)"
          />
          <Area
            type="monotone"
            dataKey="cumInterest"
            name="Interest earned"
            stackId="stack"
            stroke="#16a34a"
            strokeWidth={1.5}
            fill="url(#gradInterest)"
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="#db2777"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function InvestmentCalculator() {
  const [lumpSum, setLumpSum] = useState(50000);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(20);
  const [currency, setCurrency] = useState('USD');
  const [streams, setStreams] = useState<Contribution[]>([
    { amount: 30000, freq: 12 },
    { amount: 50000, freq: 1 },
  ]);
  const [result, setResult] = useState<InvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMonthly, setShowMonthly] = useState(false);

  function updateStream(i: number, patch: Partial<Contribution>) {
    setStreams((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStream() {
    setStreams((prev) => [...prev, { amount: 0, freq: 12 }]);
  }
  function removeStream(i: number) {
    setStreams((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleCalculate() {
    if (!Number.isFinite(lumpSum) || lumpSum < 0) {
      setError('Enter a lump sum of 0 or more.');
      setResult(null);
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError('Enter an interest rate of 0 or more.');
      setResult(null);
      return;
    }
    if (!Number.isFinite(years) || years <= 0) {
      setError('Enter an investment term greater than 0 years.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(computeInvestment(lumpSum, rate, years, streams));
    trackToolUse('investment-calculator', 'financial');
  }

  const yearlyRows = useMemo(() => {
    if (!result) return [];
    const out: InvRow[] = [];
    for (let i = 12; i <= result.rows.length; i += 12) {
      out.push(result.rows[i - 1]);
    }
    return out;
  }, [result]);

  const displayRows = showMonthly ? (result?.rows ?? []) : yearlyRows;
  const interestPct =
    result && result.finalBalance > 0
      ? Math.round((result.totalInterest / result.finalBalance) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Investment details</h2>
          <div>
            <label htmlFor="lump" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Initial lump sum
            </label>
            <input
              id="lump"
              type="number"
              min={0}
              step={1000}
              value={lumpSum}
              onChange={(e) => setLumpSum(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rate" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Expected annual return (%)
              </label>
              <input
                id="rate"
                type="number"
                min={0}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(Math.max(0, Number(e.target.value)))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="years" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Term (years)
              </label>
              <input
                id="years"
                type="number"
                min={1}
                max={60}
                step={1}
                value={years}
                onChange={(e) => setYears(Math.max(0, Number(e.target.value)))}
                className="input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="currency" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Recurring contributions
              </span>
              <button
                type="button"
                onClick={addStream}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                + Add contribution
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {streams.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    aria-label={`Contribution ${i + 1} amount`}
                    value={s.amount}
                    onChange={(e) => updateStream(i, { amount: Math.max(0, Number(e.target.value)) })}
                    className="input flex-1"
                  />
                  <select
                    aria-label={`Contribution ${i + 1} frequency`}
                    value={s.freq}
                    onChange={(e) => updateStream(i, { freq: Number(e.target.value) })}
                    className="input w-32"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.freq} value={f.freq}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeStream(i)}
                    aria-label={`Remove contribution ${i + 1}`}
                    className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Add several streams to combine, say, a monthly SIP with an annual top-up.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            className="btn-primary w-full"
          >
            Calculate
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Future value</p>
              <p className="text-4xl font-bold text-brand-600 dark:text-brand-400">
                {result ? formatCurrency(result.finalBalance, currency) : '—'}
              </p>
            </div>
            {result && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total invested</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(result.totalContributions, currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total interest</p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(result.totalInterest, currency)}
                  </p>
                </div>
              </div>
            )}
          </div>
          {result && (
            <div className="card">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Interest vs contributions</span>
                <span className="font-medium text-slate-900 dark:text-white">{interestPct}% interest</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${100 - interestPct}%` }}
                  title="Contributions"
                />
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${interestPct}%` }}
                  title="Interest"
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
                  Contributions {100 - interestPct}%
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Interest {interestPct}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <>
          <section aria-label="Growth chart" className="card">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              Balance &amp; cumulative growth
            </h2>
            <GrowthChart rows={result.rows} currency={currency} />
          </section>

          <section aria-label="Investment schedule" className="card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Investment schedule
              </h2>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showMonthly}
                  onChange={(e) => setShowMonthly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
                />
                Show monthly breakdown
              </label>
            </div>
            <div className="max-h-[28rem] overflow-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-700/60">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 font-medium">
                      {showMonthly ? 'Month' : 'Year'}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Contribution</th>
                    <th className="px-3 py-2 text-right font-medium">Interest</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => (
                    <tr
                      key={r.period}
                      className="border-t border-slate-100 transition-colors hover:bg-brand-50/50 dark:border-slate-700/60 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-3 py-2">
                        {showMonthly ? r.period : Math.ceil(r.period / 12)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-brand-600 dark:text-brand-400">
                        {formatCurrency(r.contribution, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                        {formatCurrency(r.interest, currency)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(r.balance, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Showing {showMonthly ? 'monthly' : 'yearly'} summary. Hover the chart for per-period detail.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
