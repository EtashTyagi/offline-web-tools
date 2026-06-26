// Lightweight metadata for every country that ships a per-country income-tax
// calculator. Kept free of any tax-engine imports so hub UIs can list the
// countries without pulling heavy compute code into their bundle.
// The full compute adapters live in `src/lib/taxCompare.ts`.

export interface TaxCountry {
  id: string; // tool id, e.g. "us-income-tax-calculator"
  name: string; // short display name, e.g. "United States"
  code: string; // 2-letter code for compact chart labels, e.g. "US"
  flag: string; // emoji flag
  currency: string; // ISO 4217, e.g. "USD"
  taxYear: string; // human-readable tax year label
  shortNote: string; // one line on what the engine covers
  path: string; // tool page path
}

export const TAX_COUNTRIES: TaxCountry[] = [
  {
    id: 'us-income-tax-calculator',
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    taxYear: '2024',
    shortNote: 'Federal income tax, FICA, and self-employment tax.',
    path: '/tools/financial/us-income-tax-calculator',
  },
  {
    id: 'india-income-tax-calculator',
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    currency: 'INR',
    taxYear: 'FY 2024-25',
    shortNote: 'New vs Old regime with rebates and 4% cess.',
    path: '/tools/financial/india-income-tax-calculator',
  },
  {
    id: 'uk-income-tax-calculator',
    name: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    currency: 'GBP',
    taxYear: '2025/26',
    shortNote: 'Income tax with personal allowance taper and National Insurance.',
    path: '/tools/financial/uk-income-tax-calculator',
  },
  {
    id: 'germany-income-tax-calculator',
    name: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    currency: 'EUR',
    taxYear: '2025 (VZ 2025)',
    shortNote: 'Einkommensteuer with Soli and optional church tax.',
    path: '/tools/financial/germany-income-tax-calculator',
  },
  {
    id: 'france-income-tax-calculator',
    name: 'France',
    code: 'FR',
    flag: '🇫🇷',
    currency: 'EUR',
    taxYear: '2025 (revenus 2025)',
    shortNote: 'Impôt with quotient familial and décote.',
    path: '/tools/financial/france-income-tax-calculator',
  },
  {
    id: 'spain-income-tax-calculator',
    name: 'Spain',
    code: 'ES',
    flag: '🇪🇸',
    currency: 'EUR',
    taxYear: '2025 (ejercicio 2025)',
    shortNote: 'IRPF with state and regional brackets.',
    path: '/tools/financial/spain-income-tax-calculator',
  },
  {
    id: 'italy-income-tax-calculator',
    name: 'Italy',
    code: 'IT',
    flag: '🇮🇹',
    currency: 'EUR',
    taxYear: '2025',
    shortNote: 'IRPEF with regional and municipal surtaxes.',
    path: '/tools/financial/italy-income-tax-calculator',
  },
  {
    id: 'netherlands-income-tax-calculator',
    name: 'Netherlands',
    code: 'NL',
    flag: '🇳🇱',
    currency: 'EUR',
    taxYear: '2025',
    shortNote: 'Box 1 tax with heffingskortingen credits.',
    path: '/tools/financial/netherlands-income-tax-calculator',
  },
];

export const TAX_COMPARER_PATH = '/tools/financial/tax-comparer';
