import { useMemo, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency } from '../../../lib/chart';
import { computeUkTax, TAX_YEAR_LABEL } from './ukTax';
import TaxResultView, { type TaxComponent } from '../../../components/ui/TaxResultView';

export default function UkIncomeTaxCalculator() {
  const [income, setIncome] = useState(45000);
  const [pension, setPension] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof computeUkTax> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    if (!Number.isFinite(income) || income < 0) {
      setError('Enter an income of 0 or more.');
      setResult(null);
      return;
    }
    if (income === 0) {
      setError('Enter some income to calculate.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(computeUkTax({ grossIncome: income, pensionContributionsRelief: pension }));
    trackToolUse('uk-income-tax-calculator', 'financial');
  }

  const components = useMemo<TaxComponent[]>(
    () =>
      result
        ? [
            { name: 'Income tax', value: result.incomeTax },
            { name: 'National Insurance', value: result.nationalInsurance.total },
          ]
        : [],
    [result],
  );

  const slices = useMemo(
    () =>
      result
        ? result.bracketSlices.map((s) => ({ rate: s.rate, amount: s.amount, tax: s.tax }))
        : [],
    [result],
  );

  const totalsRows = useMemo(
    () =>
      result
        ? [
            { label: 'Income tax', value: result.incomeTax, accent: 'amber' as const },
            { label: 'National Insurance', value: result.nationalInsurance.total, accent: 'amber' as const },
          ]
        : [],
    [result],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your income</h2>
          <div>
            <label htmlFor="income" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Gross annual income (£)
            </label>
            <input
              id="income"
              type="number"
              min={0}
              step={1000}
              value={income}
              onChange={(e) => setIncome(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="pension" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Pension contributions (tax-relieved)
            </label>
            <input
              id="pension"
              type="number"
              min={0}
              step={500}
              value={pension}
              onChange={(e) => setPension(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <button type="button" onClick={handleCalculate} className="btn-primary w-full">
            Calculate
          </button>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {result && (
          <TaxResultView
            currency="GBP"
            yearLabel={`Tax year ${TAX_YEAR_LABEL}`}
            note="UK income tax (England, Wales, Northern Ireland) and Class 1 National Insurance for tax year 2025/26. Personal allowance tapers above £100,000. Scotland uses different bands and is not modelled here."
            totalTax={result.totalTax}
            takeHome={result.takeHome}
            effectiveRate={result.effectiveRate}
            marginalRate={result.marginalRate}
            extraStats={[
              { label: 'Taxable income', value: formatCurrency(result.taxableIncome, 'GBP') },
            ]}
            components={components}
            slices={slices}
            totalsRows={totalsRows}
          />
        )}
      </div>
    </div>
  );
}
