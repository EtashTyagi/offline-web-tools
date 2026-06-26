import { useMemo, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency } from '../../../lib/chart';
import { computeNlTax, TAX_YEAR_LABEL } from './netherlandsTax';
import TaxResultView, { type TaxComponent } from '../../../components/ui/TaxResultView';

export default function NetherlandsIncomeTaxCalculator() {
  const [income, setIncome] = useState(50000);
  const [result, setResult] = useState<ReturnType<typeof computeNlTax> | null>(null);
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
    setResult(computeNlTax({ income }));
    trackToolUse('netherlands-income-tax-calculator', 'financial');
  }

  const components = useMemo<TaxComponent[]>(
    () =>
      result
        ? [
            { name: 'Box 1 tax (incl. social security)', value: result.box1TaxBeforeCredits },
            { name: 'Algemene heffingskorting', value: result.algemeneHeffingskorting },
            { name: 'Arbeidskorting', value: result.arbeidskorting },
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
              Box 1 income from work & home (€)
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
          <button type="button" onClick={handleCalculate} className="btn-primary w-full">
            Calculate
          </button>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {result && (
          <TaxResultView
            currency="EUR"
            yearLabel={`Netherlands ${TAX_YEAR_LABEL}`}
            note="Netherlands Box 1 income tax for 2025, including social security contributions. Applies the algemene heffingskorting and arbeidskorting. Assumes the taxpayer is below AOW (state pension) age for the whole year; Box 2 and Box 3 income are not included."
            totalTax={result.totalTax}
            takeHome={Math.max(0, income - result.totalTax)}
            effectiveRate={result.effectiveRate}
            marginalRate={result.marginalRate}
            extraStats={[
              { label: 'Gross box 1 tax', value: formatCurrency(result.box1TaxBeforeCredits, 'EUR') },
              { label: 'Total heffingskorting', value: formatCurrency(result.algemeneHeffingskorting + result.arbeidskorting, 'EUR'), accent: 'green' },
            ]}
            components={components}
            slices={result.slices}
            bandHeader="Schijf"
          />
        )}
      </div>
    </div>
  );
}
