// Tax comparison engine. Given one gross income in a chosen base currency it
// converts that income into each supported country's currency, runs that
// country's income-tax engine with sensible "single filer" defaults, and
// returns a normalized result per country plus amounts converted back into the
// base currency for apples-to-apples comparison.
//
// All tax engines are reused from the per-country calculators, so the numbers
// here match what those tools produce for a single filer with no extra
// deductions, church tax, regional surcharges, etc.

import { computeUsTax } from '../tools/financial/us-income-tax-calculator/usTax';
import { computeIndiaTax, EMPTY_DEDUCTIONS } from '../tools/financial/india-income-tax-calculator/indiaTax';
import { computeUkTax } from '../tools/financial/uk-income-tax-calculator/ukTax';
import { computeGermanTax } from '../tools/financial/germany-income-tax-calculator/germanyTax';
import { computeFrenchTax, HOUSEHOLDS } from '../tools/financial/france-income-tax-calculator/franceTax';
import { computeSpainTax } from '../tools/financial/spain-income-tax-calculator/spainTax';
import { computeItalyTax, REGIONAL_RATE_DEFAULT, MUNICIPAL_RATE_DEFAULT } from '../tools/financial/italy-income-tax-calculator/italyTax';
import { computeNlTax } from '../tools/financial/netherlands-income-tax-calculator/netherlandsTax';
import { TAX_COUNTRIES, type TaxCountry } from './taxCountries';

// Approximate exchange rates expressed as USD per 1 unit of the currency.
// Baked into the build because the tools are fully offline; they are not live.
export const FX_AS_OF = 'mid-2024 (approximate)';
export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
};

// Currencies a user can pick as the base for entering one income figure.
export const BASE_CURRENCIES: string[] = ['USD', 'EUR', 'GBP', 'INR'];

export function fxRate(fromCurrency: string, toCurrency: string): number {
  const a = FX_TO_USD[fromCurrency];
  const b = FX_TO_USD[toCurrency];
  if (!a || !b) return 1;
  return a / b;
}

export function convert(amount: number, fromCurrency: string, toCurrency: string): number {
  return amount * fxRate(fromCurrency, toCurrency);
}

interface AdapterResult {
  totalTax: number;
  takeHome: number;
  taxableIncome: number;
  effectiveRate: number;
  marginalRate: number;
}

function lastRate(slices: { rate: number; amount: number }[]): number {
  for (let i = slices.length - 1; i >= 0; i--) {
    if (slices[i].amount > 0) return slices[i].rate;
  }
  return 0;
}

function adaptUs(grossLocal: number): AdapterResult {
  const r = computeUsTax({
    status: 'single',
    wages: grossLocal,
    selfEmploymentIncome: 0,
    otherIncome: 0,
    useStandardDeduction: true,
    itemizedDeduction: 0,
  });
  return {
    totalTax: r.totalTax,
    takeHome: r.takeHome,
    taxableIncome: r.taxableIncome,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

function adaptIndia(grossLocal: number): AdapterResult {
  const r = computeIndiaTax({
    grossSalary: grossLocal,
    otherIncome: 0,
    deductions: EMPTY_DEDUCTIONS,
  });
  const regime = r.recommended === 'new' ? r.newRegime : r.oldRegime;
  return {
    totalTax: regime.totalTax,
    takeHome: grossLocal - regime.totalTax,
    taxableIncome: regime.taxableIncome,
    effectiveRate: grossLocal > 0 ? regime.totalTax / grossLocal : 0,
    marginalRate: lastRate(regime.slices),
  };
}

function adaptUk(grossLocal: number): AdapterResult {
  const r = computeUkTax({ grossIncome: grossLocal, pensionContributionsRelief: 0 });
  return {
    totalTax: r.totalTax,
    takeHome: r.takeHome,
    taxableIncome: r.taxableIncome,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

function adaptGermany(grossLocal: number): AdapterResult {
  const r = computeGermanTax({
    grossIncome: grossLocal,
    status: 'single',
    churchTaxRate: 0,
    otherDeductions: 0,
  });
  return {
    totalTax: r.totalTax,
    takeHome: r.takeHome,
    taxableIncome: r.taxableIncome,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

function adaptFrance(grossLocal: number): AdapterResult {
  const single = HOUSEHOLDS.find((h) => h.value === 'single') ?? HOUSEHOLDS[0];
  const r = computeFrenchTax({
    salariedIncome: grossLocal,
    otherIncome: 0,
    household: single.value,
    useAbatement: true,
  });
  // France engine returns income tax only (social charges on salaried income
  // are withheld separately and not part of the impôt). We compare income tax.
  const totalTax = r.incomeTax;
  return {
    totalTax,
    takeHome: grossLocal - totalTax,
    taxableIncome: r.revenuNetImposable,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

function adaptSpain(grossLocal: number): AdapterResult {
  const r = computeSpainTax({ generalIncome: grossLocal, deductibleExpenses: 0 });
  const totalTax = r.incomeTax;
  return {
    totalTax,
    takeHome: grossLocal - totalTax,
    taxableIncome: r.reducedBase,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

function adaptItaly(grossLocal: number): AdapterResult {
  const r = computeItalyTax({
    taxableIncome: grossLocal,
    regionalRate: REGIONAL_RATE_DEFAULT,
    municipalRate: MUNICIPAL_RATE_DEFAULT,
  });
  return {
    totalTax: r.totalTax,
    takeHome: grossLocal - r.totalTax,
    taxableIncome: r.taxableIncome,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

function adaptNetherlands(grossLocal: number): AdapterResult {
  const r = computeNlTax({ income: grossLocal });
  return {
    totalTax: r.totalTax,
    takeHome: grossLocal - r.totalTax,
    taxableIncome: grossLocal,
    effectiveRate: r.effectiveRate,
    marginalRate: r.marginalRate,
  };
}

const ADAPTERS: Record<string, (grossLocal: number) => AdapterResult> = {
  'us-income-tax-calculator': adaptUs,
  'india-income-tax-calculator': adaptIndia,
  'uk-income-tax-calculator': adaptUk,
  'germany-income-tax-calculator': adaptGermany,
  'france-income-tax-calculator': adaptFrance,
  'spain-income-tax-calculator': adaptSpain,
  'italy-income-tax-calculator': adaptItaly,
  'netherlands-income-tax-calculator': adaptNetherlands,
};

// Fail loudly at module load if a country is added to TAX_COUNTRIES without a
// matching adapter, rather than silently producing a 0%-tax result.
for (const c of TAX_COUNTRIES) {
  if (!ADAPTERS[c.id]) {
    throw new Error(`Missing tax adapter for country "${c.id}".`);
  }
}

export interface CountryResult {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  taxYear: string;
  note: string;
  grossLocal: number;
  totalTaxLocal: number;
  takeHomeLocal: number;
  taxableIncomeLocal: number;
  effectiveRate: number; // fraction 0..1
  marginalRate: number; // fraction 0..1
  totalTaxBase: number;
  takeHomeBase: number;
}

export interface CompareResult {
  baseCurrency: string;
  grossBase: number;
  countries: CountryResult[];
  lowestTaxId: string;
  highestTaxId: string;
}

function noteFor(country: TaxCountry): string {
  switch (country.id) {
    case 'us-income-tax-calculator':
      return 'Single filer, standard deduction. Total includes FICA (Social Security + Medicare); excludes state tax.';
    case 'india-income-tax-calculator':
      return 'Salaried, New vs Old regime, better of the two. Income tax + cess only; social security (PF) not included.';
    case 'uk-income-tax-calculator':
      return 'No pension relief. Total includes employee National Insurance.';
    case 'germany-income-tax-calculator':
      return 'Single, no church tax, no extra deductions. Income tax + Soli only; social insurance not included.';
    case 'france-income-tax-calculator':
      return 'Single, quotient familial, 10% abatement. Income tax only; social charges excluded.';
    case 'spain-income-tax-calculator':
      return 'No deductible expenses. State + regional IRPF brackets. Income tax only; social security not included.';
    case 'italy-income-tax-calculator':
      return 'Typical regional + municipal surcharges. IRPEF income tax only; INPS social security not included.';
    case 'netherlands-income-tax-calculator':
      return 'Box 1 work income with general + labour credits applied. Rates include social security contributions.';
    default:
      return country.shortNote;
  }
}

export function compareAll(baseCurrency: string, grossBase: number): CompareResult {
  const gross = Math.max(0, Number.isFinite(grossBase) ? grossBase : 0);
  const countries: CountryResult[] = TAX_COUNTRIES.map((c) => {
    const grossLocal = convert(gross, baseCurrency, c.currency);
    const a = ADAPTERS[c.id](grossLocal);
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      flag: c.flag,
      currency: c.currency,
      taxYear: c.taxYear,
      note: noteFor(c),
      grossLocal,
      totalTaxLocal: a.totalTax,
      takeHomeLocal: a.takeHome,
      taxableIncomeLocal: a.taxableIncome,
      effectiveRate: a.effectiveRate,
      marginalRate: a.marginalRate,
      totalTaxBase: convert(a.totalTax, c.currency, baseCurrency),
      takeHomeBase: convert(a.takeHome, c.currency, baseCurrency),
    };
  });

  const sorted = [...countries].sort((x, y) => x.totalTaxBase - y.totalTaxBase);
  const lowestTaxId = sorted[0]?.id ?? '';
  const highestTaxId = sorted[sorted.length - 1]?.id ?? '';

  return { baseCurrency, grossBase: gross, countries, lowestTaxId, highestTaxId };
}

export function sortByEffectiveRate(result: CompareResult): CountryResult[] {
  return [...result.countries].sort((a, b) => a.effectiveRate - b.effectiveRate);
}

export function sortByTakeHome(result: CompareResult): CountryResult[] {
  return [...result.countries].sort((a, b) => b.takeHomeBase - a.takeHomeBase);
}
