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
  BASE_CURRENCIES,
  compareAll,
  FX_AS_OF,
  fxRate,
  sortByEffectiveRate,
  sortByTakeHome,
  type CompareResult,
} from '../../../lib/taxCompare';
import { TAX_COUNTRIES } from '../../../lib/taxCountries';

const COUNTRY_COLORS = ['#6366f1', '#16a34a', '#f59e0b', '#0ea5e9', '#db2777', '#8b5cf6', '#14b8a6', '#ef4444'];

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface BarTipPayload {
  active?: boolean;
  payload?: { payload: { name: string; value: number; currency?: string; label?: string } }[];
}

function MoneyTip({
  active,
  payload,
  currency,
  unit,
}: BarTipPayload & { currency: string; unit: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800/95">
      <p className="font-medium text-slate-900 dark:text-white">{d.name}</p>
      <p className="text-slate-600 dark:text-slate-300">
        {unit} {formatCurrency(d.value, currency)}
      </p>
    </div>
  );
}

interface RateTipPayload {
  active?: boolean;
  payload?: { payload: { name: string; rate: number } }[];
}

function RateTip({ active, payload }: RateTipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800/95">
      <p className="font-medium text-slate-900 dark:text-white">{d.name}</p>
      <p className="text-slate-600 dark:text-slate-300">{pct(d.rate)}</p>
    </div>
  );
}

interface MarginalTipPayload {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function MarginalTip({ active, payload, label }: MarginalTipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800/95">
      <p className="mb-1 font-semibold text-slate-900 dark:text-white">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
          {p.name}: <span className="font-medium">{pct(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function TaxComparer() {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [gross, setGross] = useState(75000);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    if (!Number.isFinite(gross) || gross <= 0) {
      setError('Enter a gross income greater than 0.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(compareAll(baseCurrency, gross));
    trackToolUse('tax-comparer', 'financial');
  }

  const dark = useIsDark();
  const axisColor = dark ? '#94a3b8' : '#64748b';
  const gridColor = dark ? '#334155' : '#e2e8f0';

  const effectiveData = useMemo(
    () => (result ? sortByEffectiveRate(result).map((c) => ({ name: c.code, fullName: c.name, rate: c.effectiveRate })) : []),
    [result],
  );
  const taxData = useMemo(
    () =>
      result
        ? [...result.countries].sort((a, b) => a.totalTaxBase - b.totalTaxBase).map((c) => ({ name: c.code, fullName: c.name, value: c.totalTaxBase }))
        : [],
    [result],
  );
  const takeHomeData = useMemo(
    () =>
      result
        ? sortByTakeHome(result).map((c) => ({ name: c.code, fullName: c.name, value: c.takeHomeBase }))
        : [],
    [result],
  );
  const marginalData = useMemo(
    () =>
      result
        ? result.countries.map((c) => ({
            name: c.code,
            fullName: c.name,
            effective: c.effectiveRate,
            marginal: c.marginalRate,
          }))
        : [],
    [result],
  );

  const lowest = result?.countries.find((c) => c.id === result.lowestTaxId);
  const highest = result?.countries.find((c) => c.id === result.highestTaxId);
  const spread = result && lowest && highest ? highest.totalTaxBase - lowest.totalTaxBase : 0;
  const rateRanking = result ? sortByEffectiveRate(result) : [];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Enter one gross income in your currency. The comparer converts it to each country's currency
        and runs that country's income tax engine for a single filer with default options, then shows
        total tax and take-home pay side by side. Exchange rates are approximate ({FX_AS_OF}) and baked
        in. Everything runs in your browser.
      </p>

      <div className="card flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="base-currency" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Your currency
            </label>
            <select
              id="base-currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="input"
            >
              {BASE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gross" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Gross annual income ({baseCurrency})
            </label>
            <input
              id="gross"
              type="number"
              min={0}
              step={1000}
              value={gross}
              onChange={(e) => setGross(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <button type="button" onClick={handleCalculate} className="btn-primary h-[42px]">
            Compare
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {result && lowest && highest && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card">
              <p className="text-xs text-slate-500 dark:text-slate-400">Lowest total tax</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-green-600 dark:text-green-400">
                <span aria-hidden="true">{lowest.flag}</span> {lowest.code}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {formatCurrency(lowest.totalTaxBase, baseCurrency)} ({pct(lowest.effectiveRate)})
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500 dark:text-slate-400">Highest total tax</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-red-600 dark:text-red-400">
                <span aria-hidden="true">{highest.flag}</span> {highest.code}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {formatCurrency(highest.totalTaxBase, baseCurrency)} ({pct(highest.effectiveRate)})
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tax spread</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(spread, baseCurrency)}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Difference between cheapest and most expensive
              </p>
            </div>
          </div>

          {/* Effective rate chart */}
          <section aria-label="Effective tax rate by country" className="card">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              Effective tax rate by country
            </h2>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={effectiveData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => pct(v)}
                    tick={{ fontSize: 11, fill: axisColor }}
                    stroke={axisColor}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: axisColor }}
                    stroke={axisColor}
                    width={36}
                  />
                  <Tooltip content={<RateTip />} cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} />
                  <Bar dataKey="rate" name="Effective rate" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Sorted from lowest to highest. Effective rate is total tax as a share of gross income.
            </p>
          </section>

          {/* Total tax + take-home charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section aria-label="Total tax by country in base currency" className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                Total tax <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({baseCurrency})</span>
              </h2>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taxData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                    <YAxis
                      tickFormatter={(v: number) => formatCurrency(v, baseCurrency)}
                      tick={{ fontSize: 10, fill: axisColor }}
                      stroke={axisColor}
                      width={56}
                    />
                    <Tooltip content={<MoneyTip currency={baseCurrency} unit="Tax" />} cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} />
                    <Bar dataKey="value" name="Total tax" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section aria-label="Take-home pay by country in base currency" className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
                Take-home pay <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({baseCurrency})</span>
              </h2>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={takeHomeData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                    <YAxis
                      tickFormatter={(v: number) => formatCurrency(v, baseCurrency)}
                      tick={{ fontSize: 10, fill: axisColor }}
                      stroke={axisColor}
                      width={56}
                    />
                    <Tooltip content={<MoneyTip currency={baseCurrency} unit="Take-home" />} cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} />
                    <Bar dataKey="value" name="Take-home" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Marginal vs effective */}
          <section aria-label="Marginal versus effective tax rate" className="card">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              Marginal vs effective rate
            </h2>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginalData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} stroke={axisColor} />
                  <YAxis tickFormatter={(v: number) => pct(v)} tick={{ fontSize: 11, fill: axisColor }} stroke={axisColor} width={44} />
                  <Tooltip content={<MarginalTip />} cursor={{ fill: dark ? '#ffffff10' : '#00000008' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar dataKey="effective" name="Effective" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="marginal" name="Marginal" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              The marginal rate is the rate on your last currency unit; the effective rate is your
              overall average. A wide gap means progressive brackets bite hard at the top.
            </p>
          </section>

          {/* Ranking */}
          <section aria-label="Tax burden ranking" className="card">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              Ranked by tax burden
            </h2>
            <ol className="flex flex-col gap-2">
              {rateRanking.map((c, i) => {
                const max = Math.max(...rateRanking.map((r) => r.effectiveRate), 0.0001);
                const width = Math.round((c.effectiveRate / max) * 100);
                return (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-slate-400">{i + 1}</span>
                    <span className="w-7 text-lg" aria-hidden="true">{c.flag}</span>
                    <span className="w-28 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{c.name}</span>
                    <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${width}%`, backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
                      />
                    </span>
                    <span className="w-14 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {pct(c.effectiveRate)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Comparison table */}
          <section aria-label="Full comparison table" className="card">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              Full comparison
            </h2>
            <div className="overflow-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700/60">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 font-medium">Country</th>
                    <th className="px-3 py-2 font-medium">Currency</th>
                    <th className="px-3 py-2 text-right font-medium">Gross (local)</th>
                    <th className="px-3 py-2 text-right font-medium">Total tax (local)</th>
                    <th className="px-3 py-2 text-right font-medium">Total tax ({baseCurrency})</th>
                    <th className="px-3 py-2 text-right font-medium">Take-home ({baseCurrency})</th>
                    <th className="px-3 py-2 text-right font-medium">Eff. rate</th>
                    <th className="px-3 py-2 text-right font-medium">Marg. rate</th>
                  </tr>
                </thead>
                <tbody>
                  {result.countries.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700/60">
                      <td className="px-3 py-2">
                        <span className="mr-1.5" aria-hidden="true">{c.flag}</span>
                        <a href={countryPath(c.id)} className="font-medium text-slate-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400">
                          {c.name}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{c.currency}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.grossLocal, c.currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.totalTaxLocal, c.currency)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.id === result.lowestTaxId ? 'text-green-600 dark:text-green-400' : c.id === result.highestTaxId ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {formatCurrency(c.totalTaxBase, baseCurrency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">{formatCurrency(c.takeHomeBase, baseCurrency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(c.effectiveRate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{pct(c.marginalRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Per-country info */}
          <section aria-label="Country details" className="card">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              What each estimate includes
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.countries.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <span aria-hidden="true">{c.flag}</span> {c.name}
                    <span className="ml-auto text-xs font-normal text-slate-400">
                      1 {baseCurrency} = {fxRate(baseCurrency, c.currency).toLocaleString(undefined, { maximumFractionDigits: 2 })} {c.currency}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.taxYear}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{c.note}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Estimates use each country's published brackets for the listed tax year with single-filer
            defaults and no optional deductions or surcharges. Totals are not on the same basis: India,
            Germany, France, Spain, and Italy show income tax (and surcharges) only, with social
            contributions excluded, while the US (FICA), UK (National Insurance), and Netherlands
            (Box 1 includes social premiums) include social contributions. This biases the lowest-tax
            ranking toward the income-tax-only countries. Exchange rates are approximate ({FX_AS_OF}) and
            not live. This is for comparison, not tax advice.
          </p>
        </>
      )}
    </div>
  );
}

function countryPath(id: string): string {
  return TAX_COUNTRIES.find((c) => c.id === id)?.path ?? '';
}
