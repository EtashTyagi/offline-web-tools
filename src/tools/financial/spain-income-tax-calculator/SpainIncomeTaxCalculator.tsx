import { useMemo, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency } from '../../../lib/chart';
import { computeSpainTax, MINIMO_PERSONAL, TAX_YEAR_LABEL } from './spainTax';
import TaxResultView, { type TaxComponent } from '../../../components/ui/TaxResultView';

export default function SpainIncomeTaxCalculator() {
  const [income, setIncome] = useState(30000);
  const [expenses, setExpenses] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof computeSpainTax> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    if (income < 0 || expenses < 0) {
      setError('Enter values of 0 or more.');
      setResult(null);
      return;
    }
    if (income === 0) {
      setError('Enter some income to calculate.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(computeSpainTax({ generalIncome: income, deductibleExpenses: expenses }));
    trackToolUse('spain-income-tax-calculator', 'financial');
  }

  const components = useMemo<TaxComponent[]>(
    () => (result ? [{ name: 'IRPF (state + regional)', value: result.incomeTax }] : []),
    [result],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your income</h2>
          <div>
            <label htmlFor="income" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              General taxable income (€)
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
            <label htmlFor="expenses" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Deductible expenses / Social Security (€)
            </label>
            <input
              id="expenses"
              type="number"
              min={0}
              step={500}
              value={expenses}
              onChange={(e) => setExpenses(Math.max(0, Number(e.target.value)))}
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
            yearLabel={`Spain IRPF ${TAX_YEAR_LABEL}`}
            note="Spain IRPF for fiscal year 2025 using the combined state + common-regional withholding brackets and the €5,550 personal minimum. Regional rates vary by autonomous community (Madrid, Catalonia, Valencia, etc.) and are not modelled; savings income is taxed separately."
            totalTax={result.incomeTax}
            takeHome={Math.max(0, income - expenses - result.incomeTax)}
            effectiveRate={result.effectiveRate}
            marginalRate={result.marginalRate}
            extraStats={[
              { label: 'Taxable base', value: formatCurrency(result.taxableBase, 'EUR') },
              { label: `Base minus mínimo (${formatCurrency(MINIMO_PERSONAL, 'EUR')})`, value: formatCurrency(result.reducedBase, 'EUR') },
            ]}
            components={components}
            slices={result.slices}
            bandHeader="Tramo"
          />
        )}
      </div>
    </div>
  );
}
