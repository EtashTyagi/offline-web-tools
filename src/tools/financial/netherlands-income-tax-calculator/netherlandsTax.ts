// Netherlands income tax engine (Box 1) for tax year 2025.
// Source: Belastingdienst box 1 tarieven 2025 + heffingskortingen (algemene/arbeidskorting).
// Rates include social security contributions; assumes the taxpayer is below AOW
// (state pension) age for the full year.

export const TAX_YEAR_LABEL = '2025';

// Box 1 brackets (2025) including social security premiums.
export const BRACKETS: { rate: number; upTo: number }[] = [
  { rate: 0.3582, upTo: 38441 },
  { rate: 0.3748, upTo: 76817 },
  { rate: 0.495, upTo: Infinity },
];

// Algemene heffingskorting (2025, below AOW age).
export const ALGEMENE_MAX = 3068;
export const ALGEMENE_PHASE_OUT_FROM = 28406;
export const ALGEMENE_PHASE_OUT_TO = 76817;
export const ALGEMENE_PHASE_OUT_RATE = 0.06337;

// Arbeidskorting (2025, below AOW age).
export const ARBEID_STAGES = [
  { cap: 12169, base: 0, rate: 0.08053 },
  { cap: 26288, base: 980, rate: 0.3003 },
  { cap: 43071, base: 5220, rate: 0.02258 },
  { cap: 129078, base: 5599, rate: -0.0651 },
];

export interface NlTaxInput {
  income: number; // box 1 income from work and home ownership
}

export interface NlTaxResult {
  box1TaxBeforeCredits: number;
  algemeneHeffingskorting: number;
  arbeidskorting: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  slices: { rate: number; amount: number; tax: number }[];
}

function box1Tax(income: number): { tax: number; slices: { rate: number; amount: number; tax: number }[]; marginal: number } {
  const slices: { rate: number; amount: number; tax: number }[] = [];
  let remaining = Math.max(0, income);
  let last = 0;
  let tax = 0;
  let marginal = 0;
  for (const b of BRACKETS) {
    if (remaining <= 0) break;
    const width = b.upTo - last;
    const inBracket = Math.min(remaining, width);
    if (inBracket > 0) {
      const t = inBracket * b.rate;
      tax += t;
      slices.push({ rate: b.rate, amount: inBracket, tax: t });
      marginal = b.rate;
    }
    remaining -= inBracket;
    last = b.upTo;
  }
  return { tax, slices, marginal };
}

export function algemeneHeffingskorting(income: number): number {
  const inc = Math.max(0, income || 0);
  if (inc <= ALGEMENE_PHASE_OUT_FROM) return ALGEMENE_MAX;
  if (inc >= ALGEMENE_PHASE_OUT_TO) return 0;
  return Math.max(0, ALGEMENE_MAX - ALGEMENE_PHASE_OUT_RATE * (inc - ALGEMENE_PHASE_OUT_FROM));
}

export function arbeidskorting(income: number): number {
  const inc = Math.max(0, income || 0);
  if (inc === 0) return 0;
  let prevCap = 0;
  for (const s of ARBEID_STAGES) {
    if (inc <= s.cap) {
      return Math.max(0, s.base + s.rate * (inc - prevCap));
    }
    prevCap = s.cap;
  }
  return 0;
}

export function computeNlTax(input: NlTaxInput): NlTaxResult {
  const income = Math.max(0, input.income || 0);
  const { tax: box1TaxBeforeCredits, slices, marginal } = box1Tax(income);
  const alg = algemeneHeffingskorting(income);
  const arb = arbeidskorting(income);
  const totalTax = Math.max(0, box1TaxBeforeCredits - alg - arb);
  const effectiveRate = income > 0 ? totalTax / income : 0;
  return {
    box1TaxBeforeCredits,
    algemeneHeffingskorting: alg,
    arbeidskorting: arb,
    totalTax,
    effectiveRate,
    marginalRate: marginal,
    slices,
  };
}
