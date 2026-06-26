// United Kingdom income tax + National Insurance engine.
// Tax year 2025/26 (6 April 2025 - 5 April 2026), England / Wales / Northern Ireland.
// Source: GOV.UK Income Tax rates and National Insurance contributions (2025 to 2026).
// Scotland uses a different band structure (not modelled here).

export const TAX_YEAR_LABEL = '2025/26';

// Income tax (England, Wales, Northern Ireland)
export const PERSONAL_ALLOWANCE = 12570;
export const PA_TAPER_THRESHOLD = 100000; // allowance tapers above this
export const PA_TAPER_END = 125140; // allowance reaches zero here

export const BASIC_RATE = 0.20;
export const HIGHER_RATE = 0.40;
export const ADDITIONAL_RATE = 0.45;
export const BASIC_BAND_TOP = 37700; // taxable income (after allowance) at 20%
export const HIGHER_BAND_TOP = 125140; // taxable income at 40%; above is 45%

// National Insurance Class 1 (employee), 2025/26
export const NI_PRIMARY_THRESHOLD = 12570;
export const NI_UPPER_EARNINGS_LIMIT = 50270;
export const NI_MAIN_RATE = 0.08; // between PT and UEL
export const NI_ADDITIONAL_RATE = 0.02; // above UEL

export interface UkTaxInput {
  grossIncome: number; // total taxable income (employment + other)
  pensionContributionsRelief: number; // deducted before tax (relief at source/matched)
}

export interface UkBracketSlice {
  rate: number;
  amount: number;
  tax: number;
}

export interface UkNiBreakdown {
  mainBand: number; // taxable earnings between PT and UEL
  mainTax: number; // at 8%
  additionalBand: number; // earnings above UEL
  additionalTax: number; // at 2%
  total: number;
}

export interface UkTaxResult {
  grossIncome: number;
  personalAllowanceUsed: number;
  taxableIncome: number;
  incomeTax: number;
  bracketSlices: UkBracketSlice[];
  marginalRate: number;
  nationalInsurance: UkNiBreakdown;
  totalTax: number;
  takeHome: number;
  effectiveRate: number;
}

export function computeNi(grossIncome: number): UkNiBreakdown {
  const earnings = Math.max(0, grossIncome || 0);
  if (earnings <= NI_PRIMARY_THRESHOLD) {
    return { mainBand: 0, mainTax: 0, additionalBand: 0, additionalTax: 0, total: 0 };
  }
  const mainBand = Math.min(earnings, NI_UPPER_EARNINGS_LIMIT) - NI_PRIMARY_THRESHOLD;
  const mainTax = mainBand * NI_MAIN_RATE;
  const additionalBand = Math.max(0, earnings - NI_UPPER_EARNINGS_LIMIT);
  const additionalTax = additionalBand * NI_ADDITIONAL_RATE;
  return {
    mainBand,
    mainTax,
    additionalBand,
    additionalTax,
    total: mainTax + additionalTax,
  };
}

function computePersonalAllowance(grossIncome: number): number {
  if (grossIncome <= PA_TAPER_THRESHOLD) return PERSONAL_ALLOWANCE;
  const reduction = Math.floor((grossIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, PERSONAL_ALLOWANCE - reduction);
}

function taxOnAmount(taxable: number): { tax: number; slices: UkBracketSlice[]; marginal: number } {
  const slices: UkBracketSlice[] = [];
  let remaining = taxable;
  let tax = 0;
  let marginal = 0;
  const bands: { rate: number; width: number }[] = [
    { rate: BASIC_RATE, width: BASIC_BAND_TOP },
    { rate: HIGHER_RATE, width: HIGHER_BAND_TOP - BASIC_BAND_TOP },
    { rate: ADDITIONAL_RATE, width: Infinity },
  ];
  for (const b of bands) {
    if (remaining <= 0) break;
    const inBand = Math.min(remaining, b.width);
    if (inBand > 0) {
      const t = inBand * b.rate;
      tax += t;
      slices.push({ rate: b.rate, amount: inBand, tax: t });
      marginal = b.rate;
    }
    remaining -= inBand;
  }
  return { tax, slices, marginal };
}

export function computeUkTax(input: UkTaxInput): UkTaxResult {
  const gross = Math.max(0, input.grossIncome || 0);
  const pensionRelief = Math.max(0, input.pensionContributionsRelief || 0);
  const adjustedNetIncome = Math.max(0, gross - pensionRelief);

  const pa = computePersonalAllowance(adjustedNetIncome);
  const taxableIncome = Math.max(0, adjustedNetIncome - pa);
  const { tax: incomeTax, slices, marginal } = taxOnAmount(taxableIncome);
  const ni = computeNi(gross); // NI is on earnings before pension relief at source for salary

  const totalTax = incomeTax + ni.total;
  const takeHome = gross - totalTax - pensionRelief;
  const effectiveRate = gross > 0 ? totalTax / gross : 0;

  return {
    grossIncome: gross,
    personalAllowanceUsed: pa,
    taxableIncome,
    incomeTax,
    bracketSlices: slices,
    marginalRate: marginal,
    nationalInsurance: ni,
    totalTax,
    takeHome,
    effectiveRate,
  };
}
