import { TAX_COUNTRIES, TAX_COMPARER_PATH } from '../../../lib/taxCountries';

export default function TaxCalculators() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Pick a country for a detailed income tax estimate using that country’s brackets and
        rules, or open the Tax Comparer to enter one income and compare take-home pay across all
        eight countries. Every calculation runs in your browser.
      </p>

      <section aria-label="Compare across countries" className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Tax Comparer
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter one income and see how much tax you would pay in each country, with charts
              and a ranked breakdown.
            </p>
          </div>
          <a href={TAX_COMPARER_PATH} className="btn-primary self-start sm:self-center">
            Compare countries <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section aria-label="Country calculators">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
          Country income tax calculators
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TAX_COUNTRIES.map((c) => (
            <a
              key={c.id}
              href={c.path}
              className="card group flex flex-col gap-2 hover:ring-brand-500 dark:hover:ring-brand-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden="true">
                  {c.flag}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {c.currency} · {c.taxYear}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                {c.name}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{c.shortNote}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
