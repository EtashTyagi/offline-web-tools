import { useState } from 'react';
import { trackToolUse } from '../../../lib/track';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

interface Result {
  monthly: number;
  totalInterest: number;
  totalPaid: number;
}

function compute(loan: number, rate: number, years: number): Result {
  const monthlyRate = rate / 100 / 12;
  const months = years * 12;
  const monthly =
    monthlyRate === 0
      ? loan / months
      : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const totalPaid = monthly * months;
  return { monthly, totalInterest: totalPaid - loan, totalPaid };
}

export default function MortgageCalculator() {
  const [loan, setLoan] = useState(250000);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
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
            Loan term (years)
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
        <button
          type="button"
          onClick={handleCalculate}
          className="btn-primary w-full sm:w-auto"
        >
          Calculate
        </button>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-5 dark:bg-slate-800/50">
        {result ? (
          <>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Monthly payment</p>
              <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">{formatCurrency(result.monthly)}</p>
            </div>
            <div className="mt-2 border-t border-slate-200 pt-3 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total interest paid</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                {formatCurrency(result.totalInterest)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total paid over {years} years</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">{formatCurrency(result.totalPaid)}</p>
            </div>
          </>
        ) : (
          <p className="m-auto text-sm text-slate-500 dark:text-slate-400">
            Enter your details and press Calculate to see your monthly payment.
          </p>
        )}
      </div>
    </div>
  );
}
