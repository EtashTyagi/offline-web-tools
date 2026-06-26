// US Federal income tax engine for tax year 2024 (returns filed in 2025).
// All numbers are USD. 100% client-side; no rounding beyond cents.

export type FilingStatus = 'single' | 'mfj' | 'hoh';

export interface Bracket {
  rate: number; // marginal rate as a fraction, e.g. 0.10
  upTo: number; // top of this bracket (taxable income); Infinity for the top bracket
}

export const TAX_YEAR = 2024;

export const BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { rate: 0.10, upTo: 11600 },
    { rate: 0.12, upTo: 47150 },
    { rate: 0.22, upTo: 100525 },
    { rate: 0.24, upTo: 191950 },
    { rate: 0.32, upTo: 243725 },
    { rate: 0.35, upTo: 609350 },
    { rate: 0.37, upTo: Infinity },
  ],
  mfj: [
    { rate: 0.10, upTo: 23200 },
    { rate: 0.12, upTo: 94300 },
    { rate: 0.22, upTo: 201050 },
    { rate: 0.24, upTo: 383900 },
    { rate: 0.32, upTo: 487450 },
    { rate: 0.35, upTo: 731200 },
    { rate: 0.37, upTo: Infinity },
  ],
  hoh: [
    { rate: 0.10, upTo: 16550 },
    { rate: 0.12, upTo: 63100 },
    { rate: 0.22, upTo: 100500 },
    { rate: 0.24, upTo: 191950 },
    { rate: 0.32, upTo: 243700 },
    { rate: 0.35, upTo: 609350 },
    { rate: 0.37, upTo: Infinity },
  ],
};

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 14600,
  mfj: 29200,
  hoh: 21900,
};

// FICA constants (tax year 2024).
export const SS_RATE = 0.062;
export const SS_WAGE_BASE = 168600; // 2024 Social Security wage cap (employment).
export const MEDICARE_RATE = 0.0145;
export const ADDITIONAL_MEDICARE_RATE = 0.009;
export const ADDITIONAL_MEDICARE_THRESHOLD = 200000;

// Self-employment tax: 15.3% on 92.35% of net SE earnings, with the SS portion
// capped at the wage base and the Medicare portion uncapped.
export const SE_FACTOR = 0.9235;
export const SE_SS_RATE = 0.124; // employer + employee Social Security portion
export const SE_MEDICARE_RATE = 0.029; // employer + employee Medicare portion

export interface UsTaxInput {
  status: FilingStatus;
  wages: number; // employment wages (subject to FICA)
  selfEmploymentIncome: number; // net SE profit (drives SE tax + income tax)
  otherIncome: number; // interest, dividends, etc. (income tax only, no FICA)
  useStandardDeduction: boolean;
  itemizedDeduction: number; // used when useStandardDeduction is false
}

export interface BracketSlice {
  rate: number;
  amount: number; // taxable dollars that fell in this bracket
  tax: number; // tax produced by this bracket
}

export interface SeTaxResult {
  taxable: number; // net SE earnings subject to SE tax (after 92.35% factor)
  ssPortion: number;
  medicarePortion: number;
  additionalMedicare: number; // 0.9% on the SE portion above the threshold
  total: number;
  deductibleHalf: number; // deductible employer-equivalent portion (income-tax adjustment)
}

export interface UsTaxResult {
  grossIncome: number;
  deductionUsed: number;
  taxableIncome: number;
  agi: number;
  bracketSlices: BracketSlice[];
  incomeTaxBeforeCredits: number;
  fica: number; // Social Security + Medicare on wages
  seTax: SeTaxResult;
  totalTax: number;
  effectiveRate: number; // total tax / gross income
  marginalRate: number; // top bracket rate that applied
  takeHome: number;
}

export function computeSeTax(selfEmploymentIncome: number, wages = 0): SeTaxResult {
  if (!Number.isFinite(selfEmploymentIncome) || selfEmploymentIncome <= 0) {
    return {
      taxable: 0,
      ssPortion: 0,
      medicarePortion: 0,
      additionalMedicare: 0,
      total: 0,
      deductibleHalf: 0,
    };
  }
  const taxable = selfEmploymentIncome * SE_FACTOR;
  // The Social Security wage base is shared with wages already subject to SS.
  const ssRemaining = Math.max(0, SS_WAGE_BASE - Math.min(wages, SS_WAGE_BASE));
  const ssPortion = Math.min(taxable, ssRemaining) * SE_SS_RATE;
  const medicarePortion = taxable * SE_MEDICARE_RATE;
  // The 0.9% Additional Medicare Tax applies to combined wages + SE earnings
  // (Form 8959). The wage-side portion is withheld via FICA; the remainder
  // is paid with the SE tax.
  const combined = wages + taxable;
  const totalAdditional =
    combined > ADDITIONAL_MEDICARE_THRESHOLD
      ? (combined - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE
      : 0;
  const wagesAdditional =
    wages > ADDITIONAL_MEDICARE_THRESHOLD
      ? (wages - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE
      : 0;
  const additionalMedicare = Math.max(0, totalAdditional - wagesAdditional);
  const total = ssPortion + medicarePortion + additionalMedicare;
  const deductibleHalf = total / 2;
  return { taxable, ssPortion, medicarePortion, additionalMedicare, total, deductibleHalf };
}

export function computeFica(wages: number): number {
  if (!Number.isFinite(wages) || wages <= 0) return 0;
  const ss = Math.min(wages, SS_WAGE_BASE) * SS_RATE;
  const medicare = wages * MEDICARE_RATE;
  const additional =
    wages > ADDITIONAL_MEDICARE_THRESHOLD
      ? (wages - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE
      : 0;
  return ss + medicare + additional;
}

function taxOnAmount(taxable: number, brackets: Bracket[]): { tax: number; slices: BracketSlice[]; marginal: number } {
  const slices: BracketSlice[] = [];
  let remaining = taxable;
  let last = 0;
  let tax = 0;
  let marginal = 0;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const width = b.upTo - last;
    const inBracket = Math.min(remaining, width);
    if (inBracket > 0) {
      const bracketTax = inBracket * b.rate;
      tax += bracketTax;
      slices.push({ rate: b.rate, amount: inBracket, tax: bracketTax });
      marginal = b.rate;
    }
    remaining -= inBracket;
    last = b.upTo;
  }
  return { tax, slices, marginal };
}

export function computeUsTax(input: UsTaxInput): UsTaxResult {
  const wages = Math.max(0, input.wages || 0);
  const seIncome = Math.max(0, input.selfEmploymentIncome || 0);
  const other = Math.max(0, input.otherIncome || 0);

  const se = computeSeTax(seIncome, wages);
  const fica = computeFica(wages);

  const grossIncome = wages + seIncome + other;
  // Half of SE tax is deductible against income.
  const agi = Math.max(0, wages + seIncome + other - se.deductibleHalf);
  const deduction = input.useStandardDeduction
    ? STANDARD_DEDUCTION[input.status]
    : Math.max(0, input.itemizedDeduction || 0);
  const taxableIncome = Math.max(0, agi - deduction);

  const brackets = BRACKETS[input.status];
  const { tax: incomeTaxBeforeCredits, slices, marginal } = taxOnAmount(taxableIncome, brackets);

  const totalTax = incomeTaxBeforeCredits + fica + se.total;
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;
  const takeHome = grossIncome - totalTax;

  return {
    grossIncome,
    deductionUsed: deduction,
    taxableIncome,
    agi,
    bracketSlices: slices,
    incomeTaxBeforeCredits,
    fica,
    seTax: se,
    totalTax,
    effectiveRate,
    marginalRate: marginal,
    takeHome,
  };
}
