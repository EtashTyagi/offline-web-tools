import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency, useIsDark } from '../../../lib/chart';
import {
  computeIndiaTax,
  EMPTY_DEDUCTIONS,
  type IndiaDeductions,
  type IndiaTaxInput,
  type Regime,
  type RegimeResult,
} from './indiaTax';

function formatINR(value: number): string {
  return formatCurrency(value, 'INR');
}

interface CompareDatum {
  name: string;
  new: number;
  old: number;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface TooltipPayload {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
      <p className="mb-1 font-semibold text-slate-900 dark:text-white">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
            aria-hidden="true"
          />
          {p.name}: <span className="font-medium">{formatINR(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function RegimeBreakdown({ r, title }: { r: RegimeResult; title: string }) {
  return (
    <div className="card flex flex-col gap-3">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Taxable income</p>
          <p className="font-semibold text-slate-900 dark:text-white">{formatINR(r.taxableIncome)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tax before rebate</p>
          <p className="font-semibold text-slate-900 dark:text-white">{formatINR(r.taxBeforeRebate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">87A rebate</p>
          <p className="font-semibold text-green-600 dark:text-green-400">- {formatINR(r.rebate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">4% cess</p>
          <p className="font-semibold text-slate-900 dark:text-white">{formatINR(r.cess)}</p>
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
        <p className="text-xs text-slate-500 dark:text-slate-400">Total tax payable</p>
        <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{formatINR(r.totalTax)}</p>
      </div>
      {r.slices.length > 0 && (
        <div className="overflow-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700/60">
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Slab rate</th>
                <th className="px-3 py-2 text-right font-medium">Amount taxed</th>
                <th className="px-3 py-2 text-right font-medium">Tax</th>
              </tr>
            </thead>
            <tbody>
              {r.slices.map((s, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="px-3 py-2">{Math.round(s.rate * 100)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(s.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-brand-600 dark:text-brand-400">{formatINR(s.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompareChart({ data }: { data: CompareDatum[] }) {
  const dark = useIsDark();
  const axisColor = dark ? '#94a3b8' : '#64748b';
  const gridColor = dark ? '#334155' : '#e2e8f0';
  if (data.length === 0) return null;
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} stroke={axisColor} />
          <YAxis tickFormatter={(v: number) => formatINR(v)} tick={{ fontSize: 11, fill: axisColor }} stroke={axisColor} width={70} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} />
          <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} iconType="circle" />
          <Bar dataKey="new" name="New Regime" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="old" name="Old Regime" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function IndiaIncomeTaxCalculator() {
  const [grossSalary, setGrossSalary] = useState(1200000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [deductions, setDeductions] = useState<IndiaDeductions>({ ...EMPTY_DEDUCTIONS });
  const [result, setResult] = useState<ReturnType<typeof computeIndiaTax> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateDed(field: keyof IndiaDeductions, value: number) {
    setDeductions((prev) => ({ ...prev, [field]: Math.max(0, value) }));
  }

  function handleCalculate() {
    if (grossSalary < 0 || otherIncome < 0) {
      setError('Enter income values of 0 or more.');
      setResult(null);
      return;
    }
    if (grossSalary + otherIncome === 0) {
      setError('Enter some income to calculate.');
      setResult(null);
      return;
    }
    setError(null);
    const input: IndiaTaxInput = { grossSalary, otherIncome, deductions };
    setResult(computeIndiaTax(input));
    trackToolUse('india-income-tax-calculator', 'financial');
  }

  const compareData = useMemo<CompareDatum[]>(() => {
    if (!result) return [];
    return [
      { name: 'Tax before rebate', new: result.newRegime.taxBeforeRebate, old: result.oldRegime.taxBeforeRebate },
      { name: 'Rebate', new: result.newRegime.rebate, old: result.oldRegime.rebate },
      { name: 'Cess', new: result.newRegime.cess, old: result.oldRegime.cess },
      { name: 'Total tax', new: result.newTotalTax, old: result.oldTotalTax },
    ];
  }, [result]);

  const savings = result ? Math.abs(result.newTotalTax - result.oldTotalTax) : 0;
  const recLabel: Record<Regime, string> = { new: 'New Regime', old: 'Old Regime' };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        India income tax for FY 2024-25 (AY 2025-26). Compare the New and Old regimes with
        standard deductions, 80C, 80D, NPS, HRA, and home-loan interest, plus the 4% cess.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your income</h2>
          <div>
            <label htmlFor="gross" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Gross salary (annual)
            </label>
            <input
              id="gross"
              type="number"
              min={0}
              step={10000}
              value={grossSalary}
              onChange={(e) => setGrossSalary(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="other" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Other taxable income
            </label>
            <input
              id="other"
              type="number"
              min={0}
              step={10000}
              value={otherIncome}
              onChange={(e) => setOtherIncome(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>

          <h3 className="pt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Deductions (Old Regime)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="d80c" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                80C (PF, ELSS) — cap 1.5L
              </label>
              <input
                id="d80c"
                type="number"
                min={0}
                step={5000}
                value={deductions.section80C}
                onChange={(e) => updateDed('section80C', Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="d80d" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                80D (health insurance)
              </label>
              <input
                id="d80d"
                type="number"
                min={0}
                step={5000}
                value={deductions.section80D}
                onChange={(e) => updateDed('section80D', Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="dnps" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                80CCD(1B) NPS — cap 50K
              </label>
              <input
                id="dnps"
                type="number"
                min={0}
                step={5000}
                value={deductions.section80CCD1B}
                onChange={(e) => updateDed('section80CCD1B', Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="dhra" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                HRA exempted
              </label>
              <input
                id="dhra"
                type="number"
                min={0}
                step={5000}
                value={deductions.hraExempted}
                onChange={(e) => updateDed('hraExempted', Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="dhome" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Home loan interest — cap 2L
              </label>
              <input
                id="dhome"
                type="number"
                min={0}
                step={5000}
                value={deductions.homeLoanInterest}
                onChange={(e) => updateDed('homeLoanInterest', Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="dother" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Other deductions (80G, 80E…)
              </label>
              <input
                id="dother"
                type="number"
                min={0}
                step={5000}
                value={deductions.other}
                onChange={(e) => updateDed('other', Number(e.target.value))}
                className="input"
              />
            </div>
          </div>
          <button type="button" onClick={handleCalculate} className="btn-primary w-full">
            Calculate
          </button>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card flex flex-col gap-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Recommended regime</p>
              <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                {result ? recLabel[result.recommended] : '—'}
              </p>
            </div>
            {result && savings > 0 && (
              <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You save {formatINR(savings)} with the {recLabel[result.recommended]}.
                </p>
              </div>
            )}
            {result && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">New regime tax</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatINR(result.newTotalTax)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Old regime tax</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatINR(result.oldTotalTax)}
                  </p>
                </div>
              </div>
            )}
          </div>
          {result && compareData.length > 0 && (
            <div className="card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                New vs Old regime
              </h2>
              <CompareChart data={compareData} />
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RegimeBreakdown r={result.newRegime} title="New Regime breakdown" />
          <RegimeBreakdown r={result.oldRegime} title="Old Regime breakdown" />
        </div>
      )}
    </div>
  );
}
