// India income tax engine for FY 2024-25 (Assessment Year 2025-26).
// All amounts in INR. Implements both the New and Old regimes with a
// Health & Education Cess of 4% on income tax.

export type Regime = 'new' | 'old';

export interface Bracket {
  rate: number; // fraction, e.g. 0.05
  upTo: number; // top of this slab; Infinity for the top slab
}

// New regime FY 2024-25 slabs (default).
export const NEW_BRACKETS: Bracket[] = [
  { rate: 0, upTo: 300000 },
  { rate: 0.05, upTo: 700000 },
  { rate: 0.10, upTo: 1000000 },
  { rate: 0.15, upTo: 1200000 },
  { rate: 0.20, upTo: 1500000 },
  { rate: 0.30, upTo: Infinity },
];

// Old regime FY 2024-25 slabs (below 60).
export const OLD_BRACKETS: Bracket[] = [
  { rate: 0, upTo: 250000 },
  { rate: 0.05, upTo: 500000 },
  { rate: 0.20, upTo: 1000000 },
  { rate: 0.30, upTo: Infinity },
];

export const NEW_STANDARD_DEDUCTION = 75000; // salaried, new regime FY 2024-25
export const OLD_STANDARD_DEDUCTION = 50000; // salaried, old regime

export const CESS_RATE = 0.04; // Health & Education Cess

// 87A rebate thresholds.
export const NEW_REBATE_THRESHOLD = 700000; // taxable income <= 7L -> rebate removes tax up to 25000
export const NEW_REBATE_MAX = 25000;
export const OLD_REBATE_THRESHOLD = 500000; // taxable income <= 5L -> rebate up to 12500
export const OLD_REBATE_MAX = 12500;

// Common deduction caps (old regime).
export const DEDUCTION_80C_CAP = 150000;
export const DEDUCTION_80D_SELF_CAP = 25000; // self insurance (non-senior); capped here for simplicity
export const DEDUCTION_80CCD1B_NPS_CAP = 50000;
export const DEDUCTION_24B_HOME_LOAN_INTEREST_SELF_OCCUPIED_CAP = 200000;

export interface IndiaDeductions {
  section80C: number; // PF, ELSS, life insurance, etc.
  section80D: number; // health insurance premium
  section80CCD1B: number; // NPS
  hraExempted: number; // HRA exemption
  homeLoanInterest: number; // section 24(b) interest on self-occupied house
  other: number; // other deductions (80G, 80E, etc.)
}

export interface IndiaTaxInput {
  grossSalary: number; // salary income (salaried employee)
  otherIncome: number; // other taxable income (business, capital gains added as plain taxable)
  deductions: IndiaDeductions;
}

export interface RegimeResult {
  regime: Regime;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate: number;
  taxAfterRebate: number;
  cess: number;
  totalTax: number;
  slices: { rate: number; amount: number; tax: number }[];
}

export interface IndiaTaxResult {
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  recommended: Regime;
  newTotalTax: number;
  oldTotalTax: number;
}

function applyBrackets(taxable: number, brackets: Bracket[]): {
  tax: number;
  slices: { rate: number; amount: number; tax: number }[];
} {
  const slices: { rate: number; amount: number; tax: number }[] = [];
  let remaining = taxable;
  let last = 0;
  let tax = 0;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const width = b.upTo - last;
    const inBracket = Math.min(remaining, width);
    if (inBracket > 0) {
      const bracketTax = inBracket * b.rate;
      tax += bracketTax;
      slices.push({ rate: b.rate, amount: inBracket, tax: bracketTax });
    }
    remaining -= inBracket;
    last = b.upTo;
  }
  return { tax, slices };
}

function computeRegime(
  regime: Regime,
  input: IndiaTaxInput,
): RegimeResult {
  const gross = Math.max(0, input.grossSalary || 0);
  const other = Math.max(0, input.otherIncome || 0);
  const d = input.deductions;

  if (regime === 'new') {
    // New regime: standard deduction for salaried + employer NPS (80CCD(2))
    // is allowed, but most other deductions are not. We only apply the
    // standard deduction plus the employer NPS portion is out of scope here.
    const stdDed = gross > 0 ? NEW_STANDARD_DEDUCTION : 0;
    const taxable = Math.max(0, gross + other - stdDed);
    const { tax, slices } = applyBrackets(taxable, NEW_BRACKETS);
    const rebate = taxable <= NEW_REBATE_THRESHOLD ? Math.min(tax, NEW_REBATE_MAX) : 0;
    const taxAfterRebate = Math.max(0, tax - rebate);
    const cess = taxAfterRebate * CESS_RATE;
    return {
      regime,
      taxableIncome: taxable,
      taxBeforeRebate: tax,
      rebate,
      taxAfterRebate,
      cess,
      totalTax: taxAfterRebate + cess,
      slices,
    };
  }

  // Old regime: standard deduction + chapter VI-A deductions.
  const stdDed = gross > 0 ? OLD_STANDARD_DEDUCTION : 0;
  const cap80C = Math.min(Math.max(0, d.section80C), DEDUCTION_80C_CAP);
  const cap80D = Math.min(Math.max(0, d.section80D), DEDUCTION_80D_SELF_CAP);
  const capNPS = Math.min(Math.max(0, d.section80CCD1B), DEDUCTION_80CCD1B_NPS_CAP);
  const capHra = Math.max(0, d.hraExempted);
  const capHomeLoan = Math.min(Math.max(0, d.homeLoanInterest), DEDUCTION_24B_HOME_LOAN_INTEREST_SELF_OCCUPIED_CAP);
  const otherDed = Math.max(0, d.other);
  const totalDeductions =
    stdDed + cap80C + cap80D + capNPS + capHra + capHomeLoan + otherDed;
  const taxable = Math.max(0, gross + other - totalDeductions);
  const { tax, slices } = applyBrackets(taxable, OLD_BRACKETS);
  const rebate = taxable <= OLD_REBATE_THRESHOLD ? Math.min(tax, OLD_REBATE_MAX) : 0;
  const taxAfterRebate = Math.max(0, tax - rebate);
  const cess = taxAfterRebate * CESS_RATE;
  return {
    regime,
    taxableIncome: taxable,
    taxBeforeRebate: tax,
    rebate,
    taxAfterRebate,
    cess,
    totalTax: taxAfterRebate + cess,
    slices,
  };
}

export function computeIndiaTax(input: IndiaTaxInput): IndiaTaxResult {
  const newRegime = computeRegime('new', input);
  const oldRegime = computeRegime('old', input);
  const recommended: Regime = newRegime.totalTax <= oldRegime.totalTax ? 'new' : 'old';
  return {
    newRegime,
    oldRegime,
    recommended,
    newTotalTax: newRegime.totalTax,
    oldTotalTax: oldRegime.totalTax,
  };
}

export const EMPTY_DEDUCTIONS: IndiaDeductions = {
  section80C: 0,
  section80D: 0,
  section80CCD1B: 0,
  hraExempted: 0,
  homeLoanInterest: 0,
  other: 0,
};
