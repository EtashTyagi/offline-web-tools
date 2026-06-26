import { useMemo, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency } from '../../../lib/chart';
import { computeItalyTax, MUNICIPAL_RATE_DEFAULT, REGIONAL_RATE_DEFAULT, TAX_YEAR_LABEL } from './italyTax';
import TaxResultView, { type TaxComponent } from '../../../components/ui/TaxResultView';

export default function ItalyIncomeTaxCalculator() {
  const [income, setIncome] = useState(30000);
  const [regional, setRegional] = useState(REGIONAL_RATE_DEFAULT * 100);
  const [municipal, setMunicipal] = useState(MUNICIPAL_RATE_DEFAULT * 100);
  const [result, setResult] = useState<ReturnType<typeof computeItalyTax> | null>(null);
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
    setResult(computeItalyTax({
      taxableIncome: income,
      regionalRate: regional / 100,
      municipalRate: municipal / 100,
    }));
    trackToolUse('italy-income-tax-calculator', 'financial');
  }

  const components = useMemo<TaxComponent[]>(
    () =>
      result
        ? [
            { name: 'National IRPEF', value: result.nationalIrpef },
            { name: 'Regional add-on', value: result.regionalTax },
            { name: 'Municipal add-on', value: result.municipalTax },
          ]
        : [],
    [result],
  );

  const totalsRows = useMemo(
    () =>
      result
        ? [
            { label: 'National IRPEF', value: result.nationalIrpef },
            { label: 'Addizionale regionale', value: result.regionalTax, accent: 'amber' as const },
            { label: 'Addizionale comunale', value: result.municipalTax, accent: 'amber' as const },
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
              Taxable income (reddito complessivo, €)
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
            <label htmlFor="regional" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Regional surtax — addizionale regionale (%)
            </label>
            <input
              id="regional"
              type="number"
              min={0}
              max={3.33}
              step={0.01}
              value={regional}
              onChange={(e) => setRegional(Math.max(0, Number(e.target.value)))}
              className="input"
            />
            <p className="mt-1 text-xs text-slate-400">Ranges 1.23% to 3.33% by region. Default 1.4%.</p>
          </div>
          <div>
            <label htmlFor="municipal" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Municipal surtax — addizionale comunale (%)
            </label>
            <input
              id="municipal"
              type="number"
              min={0}
              max={0.9}
              step={0.01}
              value={municipal}
              onChange={(e) => setMunicipal(Math.max(0, Number(e.target.value)))}
              className="input"
            />
            <p className="mt-1 text-xs text-slate-400">Up to 0.9% by comune. Default 0.8%.</p>
          </div>
          <button type="button" onClick={handleCalculate} className="btn-primary w-full">
            Calculate
          </button>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {result && (
          <TaxResultView
            currency="EUR"
            yearLabel={`Italy IRPEF ${TAX_YEAR_LABEL}`}
            note="Italy IRPEF for tax year 2025: national brackets (23/35/43%) plus regional and municipal surtaxes on the same taxable base. The no-tax-area detrazioni for employees and low incomes are not fully modelled."
            totalTax={result.totalTax}
            takeHome={Math.max(0, income - result.totalTax)}
            effectiveRate={result.effectiveRate}
            marginalRate={result.marginalRate}
            extraStats={[{ label: 'Taxable income', value: formatCurrency(result.taxableIncome, 'EUR') }]}
            components={components}
            slices={result.slices}
            bandHeader="Scaglione"
            totalsRows={totalsRows}
          />
        )}
      </div>
    </div>
  );
}
