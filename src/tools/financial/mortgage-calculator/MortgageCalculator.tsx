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

interface Row {
  period: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  cumInterest: number;
  cumPrincipal: number;
}

interface Result {
  monthly: number;
  totalInterest: number;
  totalPaid: number;
  rows: Row[];
}

function compute(loan: number, rate: number, years: number): Result {
  const monthlyRate = rate / 100 / 12;
  const months = years * 12;
  const monthly =
    monthlyRate === 0
      ? loan / months
      : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

  const rows: Row[] = [];
  let balance = loan;
  let cumInterest = 0;
  let cumPrincipal = 0;
  for (let i = 1; i <= months; i++) {
    const interest = balance * monthlyRate;
    const principal = monthly - interest;
    balance = Math.max(0, balance - principal);
    cumInterest += interest;
    cumPrincipal += principal;
    rows.push({
      period: i,
      payment: monthly,
      interest,
      principal,
      balance,
      cumInterest,
      cumPrincipal,
    });
  }

  const totalPaid = monthly * months;
  return { monthly, totalInterest: totalPaid - loan, totalPaid, rows };
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
  cumInterest: number;
  cumPrincipal: number;
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
        Principal paid: <span className="font-medium">{formatCurrency(datum.cumPrincipal, currency)}</span>
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        Interest paid: <span className="font-medium">{formatCurrency(datum.cumInterest, currency)}</span>
      </p>
    </div>
  );
}

function AmortChart({ rows, currency }: { rows: Row[]; currency: string }) {
  const dark = useIsDark();
  const data = useMemo<ChartDatum[]>(
    () =>
      rows.map((r) => ({
        period: r.period,
        year: Math.ceil(r.period / 12),
        month: ((r.period - 1) % 12) + 1,
        balance: r.balance,
        cumInterest: r.cumInterest,
        cumPrincipal: r.cumPrincipal,
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
            <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradInterest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
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
            dataKey="cumPrincipal"
            name="Principal paid"
            stackId="paid"
            stroke="#6366f1"
            strokeWidth={1.5}
            fill="url(#gradPrincipal)"
          />
          <Area
            type="monotone"
            dataKey="cumInterest"
            name="Interest paid"
            stackId="paid"
            stroke="#f59e0b"
            strokeWidth={1.5}
            fill="url(#gradInterest)"
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="Remaining balance"
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

export default function MortgageCalculator() {
  const [loan, setLoan] = useState(250000);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);
  const [currency, setCurrency] = useState('USD');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMonthly, setShowMonthly] = useState(false);

  function handleCalculate() {
    if (!Number.isFinite(loan) || loan <= 0) {
      setError('Enter a loan amount greater than 0.');
      setResult(null);
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError('Enter an interest rate of 0 or more.');
      setResult(null);
      return;
    }
    if (!Number.isFinite(years) || years <= 0) {
      setError('Enter a loan term greater than 0 years.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(compute(loan, rate, years));
    trackToolUse('mortgage-calculator', 'financial');
  }

  const yearlyRows = useMemo(() => {
    if (!result) return [];
    const out: Row[] = [];
    for (let i = 12; i <= result.rows.length; i += 12) {
      out.push(result.rows[i - 1]);
    }
    return out;
  }, [result]);

  const displayRows = showMonthly ? (result?.rows ?? []) : yearlyRows;
  const interestPct =
    result && result.totalPaid > 0
      ? Math.round((result.totalInterest / result.totalPaid) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Loan details</h2>
          <div>
            <label htmlFor="loan" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Loan amount
            </label>
            <input
              id="loan"
              type="number"
              min={0}
              step={1000}
              value={loan}
              onChange={(e) => setLoan(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rate" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Interest rate (%)
              </label>
              <input
                id="rate"
                type="number"
                min={0}
                step={0.05}
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
                max={40}
                step={1}
                value={years}
                onChange={(e) => setYears(Math.max(1, Number(e.target.value)))}
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
          <button
            type="button"
            onClick={handleCalculate}
            className="btn-primary w-full"
          >
            Calculate
          </button>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Monthly payment</p>
              <p className="text-4xl font-bold text-brand-600 dark:text-brand-400">
                {result ? formatCurrency(result.monthly, currency) : '—'}
              </p>
            </div>
            {result && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total interest</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(result.totalInterest, currency)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total paid</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(result.totalPaid, currency)}
                  </p>
                </div>
              </div>
            )}
          </div>
          {result && (
            <div className="card">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Interest vs principal</span>
                <span className="font-medium text-slate-900 dark:text-white">{interestPct}% interest</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${100 - interestPct}%` }}
                  title="Principal"
                />
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${interestPct}%` }}
                  title="Interest"
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
                  Principal {100 - interestPct}%
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Interest {interestPct}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <>
          <section
            aria-label="Amortization chart"
            className="card"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              Balance &amp; cumulative payments
            </h2>
            <AmortChart rows={result.rows} currency={currency} />
          </section>

          <section aria-label="Amortization schedule" className="card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Amortization schedule
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
                    <th className="px-3 py-2 text-right font-medium">Payment</th>
                    <th className="px-3 py-2 text-right font-medium">Principal</th>
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
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(r.payment, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-brand-600 dark:text-brand-400">
                        {formatCurrency(r.principal, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
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
