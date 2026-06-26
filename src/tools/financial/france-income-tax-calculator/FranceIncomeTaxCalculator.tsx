import { useMemo, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency } from '../../../lib/chart';
import { computeFrenchTax, HOUSEHOLDS, TAX_YEAR_LABEL, type FrenchHousehold } from './franceTax';
import TaxResultView, { type TaxComponent } from '../../../components/ui/TaxResultView';

export default function FranceIncomeTaxCalculator() {
  const [salaried, setSalaried] = useState(40000);
  const [other, setOther] = useState(0);
  const [household, setHousehold] = useState<FrenchHousehold>('single');
  const [useAbatement, setUseAbatement] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof computeFrenchTax> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    if (salaried < 0 || other < 0) {
      setError('Enter income values of 0 or more.');
      setResult(null);
      return;
    }
    if (salaried + other === 0) {
      setError('Enter some income to calculate.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(computeFrenchTax({ salariedIncome: salaried, otherIncome: other, household, useAbatement }));
    trackToolUse('france-income-tax-calculator', 'financial');
  }

  const components = useMemo<TaxComponent[]>(
    () =>
      result
        ? [
            { name: 'Income tax (IR)', value: result.incomeTax },
            { name: 'Décote relief', value: result.decote },
          ]
        : [],
    [result],
  );

  const totalsRows = useMemo(
    () =>
      result
        ? [
            ...(result.qfCap > 0 ? [{ label: 'QF cap adjustment', value: result.qfCap, accent: 'amber' as const }] : []),
            { label: 'Tax before décote', value: result.incomeBeforeDecote },
            { label: 'Décote', value: -result.decote, accent: 'amber' as const },
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
            <label htmlFor="salaried" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Salaried income (€)
            </label>
            <input
              id="salaried"
              type="number"
              min={0}
              step={1000}
              value={salaried}
              onChange={(e) => setSalaried(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="other" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Other taxable income (€)
            </label>
            <input
              id="other"
              type="number"
              min={0}
              step={1000}
              value={other}
              onChange={(e) => setOther(Math.max(0, Number(e.target.value)))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="hh" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Household (quotient familial)
            </label>
            <select
              id="hh"
              value={household}
              onChange={(e) => setHousehold(e.target.value as FrenchHousehold)}
              className="input"
            >
              {HOUSEHOLDS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={useAbatement}
              onChange={(e) => setUseAbatement(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
            />
            Apply 10% frais professionnels deduction
          </label>
          <button type="button" onClick={handleCalculate} className="btn-primary w-full">
            Calculate
          </button>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {result && (
          <TaxResultView
            currency="EUR"
            yearLabel={`France ${TAX_YEAR_LABEL}`}
            note="France impôt sur le revenu for revenus 2025. Uses the 5-bracket scale applied per part of quotient familial, the 10% frais professionnels abatement (min €509, max €14,555), plafonnement du quotient familial (€1,807 per half-part), and the décote for modest incomes. Social charges (CSG/CRDS) are not included."
            totalTax={result.incomeTax}
            takeHome={Math.max(0, salaried + other - result.incomeTax)}
            effectiveRate={result.effectiveRate}
            marginalRate={result.marginalRate}
            extraStats={[
              { label: 'Parts (QF)', value: String(result.parts) },
              { label: 'Net imposable', value: formatCurrency(result.revenuNetImposable, 'EUR') },
            ]}
            components={components}
            slices={result.slices}
            bandHeader="Tranche"
            totalsRows={totalsRows}
          />
        )}
      </div>
    </div>
  );
}
