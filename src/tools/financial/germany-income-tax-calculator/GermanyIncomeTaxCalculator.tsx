import { useMemo, useState } from 'react';
import { trackToolUse } from '../../../lib/track';
import { formatCurrency } from '../../../lib/chart';
import { computeGermanTax, KIRCHENSTEUER_RATES, TAX_YEAR_LABEL, type GermanFilingStatus } from './germanyTax';
import TaxResultView, { type TaxComponent } from '../../../components/ui/TaxResultView';

const STATUS_OPTIONS: { value: GermanFilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married (joint)' },
];

export default function GermanyIncomeTaxCalculator() {
  const [gross, setGross] = useState(50000);
  const [status, setStatus] = useState<GermanFilingStatus>('single');
  const [churchRate, setChurchRate] = useState(0);
  const [otherDed, setOtherDed] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof computeGermanTax> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    if (!Number.isFinite(gross) || gross < 0) {
      setError('Enter an income of 0 or more.');
      setResult(null);
      return;
    }
    if (gross === 0) {
      setError('Enter some income to calculate.');
      setResult(null);
      return;
    }
    setError(null);
    setResult(computeGermanTax({ grossIncome: gross, status, churchTaxRate: churchRate, otherDeductions: otherDed }));
    trackToolUse('germany-income-tax-calculator', 'financial');
  }

  const components = useMemo<TaxComponent[]>(
    () =>
      result
        ? [
            { name: 'Einkommensteuer', value: result.incomeTax },
            { name: 'Solidaritätszuschlag', value: result.soli },
            { name: 'Kirchensteuer', value: result.churchTax },
          ]
        : [],
    [result],
  );

  const totalsRows = useMemo(
    () =>
      result
        ? [
            { label: 'Einkommensteuer', value: result.incomeTax },
            { label: 'Solidaritätszuschlag', value: result.soli, accent: 'amber' as const },
            { label: 'Kirchensteuer', value: result.churchTax, accent: 'amber' as const },
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
            <label htmlFor="gross" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Gross annual income (€)
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
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Filing status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as GermanFilingStatus)}
              className="input"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="church" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Church tax (Kirchensteuer)
            </label>
            <select
              id="church"
              value={churchRate}
              onChange={(e) => setChurchRate(Number(e.target.value))}
              className="input"
            >
              {KIRCHENSTEUER_RATES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ded" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Other deductions (Sonderausgaben, Vorsorge)
            </label>
            <input
              id="ded"
              type="number"
              min={0}
              step={500}
              value={otherDed}
              onChange={(e) => setOtherDed(Math.max(0, Number(e.target.value)))}
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
            yearLabel={`Germany tax year ${TAX_YEAR_LABEL}`}
            note="German Einkommensteuer for 2025 using the §32a EStG tariff, the Splittingverfahren for married couples, the Solidaritätszuschlag (Soli) with its €19,950 / €39,900 Freigrenze, and optional Kirchensteuer. Uses the €1,230 Werbungskostenpauschbetrag; health/pension insurance and other credits are not fully modelled."
            totalTax={result.totalTax}
            takeHome={result.takeHome}
            effectiveRate={result.effectiveRate}
            marginalRate={result.marginalRate}
            extraStats={[{ label: 'Taxable income (zvE)', value: formatCurrency(result.taxableIncome, 'EUR') }]}
            components={components}
            slices={result.slices}
            bandHeader="Marginal rate"
            totalsRows={totalsRows}
          />
        )}
      </div>
    </div>
  );
}
