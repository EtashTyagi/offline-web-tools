import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency, useIsDark } from '../../../lib/chart';
import {
  computeUsTax,
  type FilingStatus,
  STANDARD_DEDUCTION,
  TAX_YEAR,
  type UsTaxInput,
} from './usTax';

const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'mfj', label: 'Married Filing Jointly' },
  { value: 'hoh', label: 'Head of Household' },
];

const PIE_COLORS = ['#6366f1', '#f59e0b', '#16a34a'];

function formatUSD(value: number): string {
  return formatCurrency(value, 'USD');
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface BracketDatum {
  label: string;
  amount: number;
  tax: number;
}

interface PieDatum {
  name: string;
  value: number;
}

interface PiePayload {
  active?: boolean;
  payload?: { payload: PieDatum }[];
}

function TaxPie({ active, payload }: PiePayload) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800/95">
      <p className="font-medium text-slate-900 dark:text-white">{d.name}</p>
      <p className="text-slate-600 dark:text-slate-300">{formatUSD(d.value)}</p>
    </div>
  );
}

interface BarTooltipPayload {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function BracketTooltip({ active, payload, label }: BarTooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800/95">
      <p className="mb-1 font-semibold text-slate-900 dark:text-white">Bracket {label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
          {p.name}: <span className="font-medium">{formatUSD(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function UsIncomeTaxCalculator() {
  const [status, setStatus] = useState<FilingStatus>('single');
  const [wages, setWages] = useState(80000);
  const [seIncome, setSeIncome] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);
  const [useStandard, setUseStandard] = useState(true);
  const [itemized, setItemized] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof computeUsTax> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    const input: UsTaxInput = {
      status,
      wages,
      selfEmploymentIncome: seIncome,
      otherIncome,
      useStandardDeduction: useStandard,
      itemizedDeduction: itemized,
    };
    if (input.wages < 0 || input.selfEmploymentIncome < 0 || input.otherIncome < 0) {
      setError('Enter income values of 0 or more.');
      setResult(null);
      return;
    }
    if (input.wages + input.selfEmploymentIncome + input.otherIncome === 0) {
      setError('Enter some income to calculate.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(computeUsTax(input));
    trackToolUse('us-income-tax-calculator', 'financial');
  }

  const bracketData = useMemo<BracketDatum[]>(() => {
    if (!result) return [];
    return result.bracketSlices.map((s) => ({
      label: `${Math.round(s.rate * 100)}%`,
      amount: s.amount,
      tax: s.tax,
    }));
  }, [result]);

  const pieData = useMemo<PieDatum[]>(() => {
    if (!result) return [];
    return [
      { name: 'Federal income tax', value: result.incomeTaxBeforeCredits },
      { name: 'FICA (wages)', value: result.fica },
      { name: 'Self-employment tax', value: result.seTax.total },
    ]
      .filter((d) => d.value > 0)
      .map((d, i) => ({ ...d, fill: PIE_COLORS[i % PIE_COLORS.length] }));
  }, [result]);

  const dark = useIsDark();
  const axisColor = dark ? '#94a3b8' : '#64748b';
  const gridColor = dark ? '#334155' : '#e2e8f0';

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        US federal income tax for tax year {TAX_YEAR}. Estimates federal income tax, FICA
        (Social Security + Medicare), and self-employment tax. State taxes are not included.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your income</h2>
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Filing status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as FilingStatus)}
              className="input"
            >
              {FILING_STATUSES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wages" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Wages / salary (W-2)
            </label>
            <input
              id="wages"
              type="number"
              min={0}
              step={1000}
              value={wages}
              onChange={(e) => setWages(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="se" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Self-employment income (net profit)
            </label>
            <input
              id="se"
              type="number"
              min={0}
              step={1000}
              value={seIncome}
              onChange={(e) => setSeIncome(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="other" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Other taxable income (interest, dividends, etc.)
            </label>
            <input
              id="other"
              type="number"
              min={0}
              step={500}
              value={otherIncome}
              onChange={(e) => setOtherIncome(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Deduction
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="deduction"
                  checked={useStandard}
                  onChange={() => setUseStandard(true)}
                  className="h-4 w-4 text-brand-600"
                />
                Standard ({formatUSD(STANDARD_DEDUCTION[status])})
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="deduction"
                  checked={!useStandard}
                  onChange={() => setUseStandard(false)}
                  className="h-4 w-4 text-brand-600"
                />
                Itemized
              </label>
            </div>
            {!useStandard && (
              <input
                id="itemized"
                type="number"
                min={0}
                step={500}
                aria-label="Itemized deduction amount"
                value={itemized}
                onChange={(e) => setItemized(Math.max(0, Number(e.target.value)))}
                className="input mt-2"
              />
            )}
          </div>
          <button type="button" onClick={handleCalculate} className="btn-primary w-full">
            Calculate
          </button>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total tax</p>
              <p className="text-4xl font-bold text-brand-600 dark:text-brand-400">
                {result ? formatUSD(result.totalTax) : '—'}
              </p>
            </div>
            {result && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Take-home pay</p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {formatUSD(result.takeHome)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Effective rate</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatPct(result.effectiveRate)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Marginal rate</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatPct(result.marginalRate)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Taxable income</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatUSD(result.taxableIncome)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {result && pieData.length > 0 && (
            <div className="card">
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Where your tax goes</h2>
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
                    <Tooltip content={<TaxPie />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && bracketData.length > 0 && (
        <section aria-label="Tax by bracket" className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Tax by bracket
          </h2>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bracketData} margin={{ top: 10, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                <YAxis tickFormatter={(v: number) => formatUSD(v)} tick={{ fontSize: 11, fill: axisColor }} stroke={axisColor} width={64} />
                <Tooltip content={<BracketTooltip />} cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} />
                <Bar dataKey="tax" name="Tax" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 max-h-[20rem] overflow-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700/60">
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Amount taxed</th>
                  <th className="px-3 py-2 text-right font-medium">Tax</th>
                </tr>
              </thead>
              <tbody>
                {result.bracketSlices.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-700/60">
                    <td className="px-3 py-2">{Math.round(s.rate * 100)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatUSD(s.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-brand-600 dark:text-brand-400">{formatUSD(s.tax)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 dark:border-slate-600 font-semibold">
                  <td className="px-3 py-2">Income tax</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">{formatUSD(result.incomeTaxBeforeCredits)}</td>
                </tr>
                <tr className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="px-3 py-2">FICA (wages)</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatUSD(result.fica)}</td>
                </tr>
                <tr className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="px-3 py-2">Self-employment tax</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatUSD(result.seTax.total)}</td>
                </tr>
                <tr className="border-t-2 border-slate-200 dark:border-slate-600 font-semibold">
                  <td className="px-3 py-2">Total tax</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">{formatUSD(result.totalTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
