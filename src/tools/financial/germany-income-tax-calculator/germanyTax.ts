// Germany income tax engine (Einkommensteuer) for tax year 2025 (Veranlagungszeitraum 2025).
// Source: §32a EStG 2025 (Steuerfortentwicklungsgesetz); Solidaritätszuschlag §3/§4 SolZG.
// Grundfreibetrag 2025: EUR 12,096 (single) / EUR 24,192 (joint, via Splittingverfahren).

export const TAX_YEAR_LABEL = '2025 (VZ 2025)';

export const GRUNDFREIBETRAG = 12096; // single, 2025
export const WERBUNGSKOSTEN_PAUSCHBETRAG = 1230; // flat work-related expense allowance, 2025
export const SOLI_RATE = 0.055;
export const SOLI_FREIGRENZE_SINGLE = 19950;
export const SOLI_FREIGRENZE_JOINT = 39900;
export const SOLI_RELIEF_RATE = 0.119; // Milderungszone cap rate on (ESt - Freigrenze)

export const KIRCHENSTEUER_RATES = [
  { value: 0, label: 'None' },
  { value: 0.08, label: '8% (Bavaria, Baden-Württemberg)' },
  { value: 0.09, label: '9% (other states)' },
];

export type GermanFilingStatus = 'single' | 'married';

export interface GermanTaxInput {
  grossIncome: number;
  status: GermanFilingStatus;
  churchTaxRate: number; // 0 / 0.08 / 0.09
  otherDeductions: number; // extra deductible expenses (Sonderausgaben, Vorsorge), optional
}

export interface GermanTaxResult {
  grossIncome: number;
  taxableIncome: number; // zvE (single basis; for married this is per-half used in formula? we store full)
  incomeTax: number; // tarifliche Einkommensteuer (combined for married)
  soli: number;
  churchTax: number;
  totalTax: number;
  marginalRate: number; // fraction
  effectiveRate: number; // fraction
  takeHome: number;
  slices: { rate: number; amount: number; tax: number }[];
}

// §32a EStG Grundtarif (single) for a given zvE.
function grundtarif(zvE: number): number {
  const x = Math.max(0, zvE);
  if (x <= GRUNDFREIBETRAG) return 0;
  if (x <= 17443) {
    const y = (x - 12096) / 10000;
    return (932.3 * y + 1400) * y;
  }
  if (x <= 68480) {
    const z = (x - 17443) / 10000;
    return (176.64 * z + 2397) * z + 1015.13;
  }
  if (x <= 277825) {
    return 0.42 * x - 10911.92;
  }
  return 0.45 * x - 19246.67;
}

// Marginal rate = derivative approximation by computing tax on (x+1) vs x.
function marginalRate(grundtarifFn: (x: number) => number, x: number): number {
  const t0 = grundtarifFn(Math.max(0, x));
  const t1 = grundtarifFn(Math.max(0, x) + 1);
  return Math.max(0, Math.min(0.45, t1 - t0));
}

function slicesFromBrackets(zvE: number, joint: boolean): GermanTaxResult['slices'] {
  // Approximate progressive bands for display. Germany's first two zones are
  // smooth curves, so we sample them at 1% steps for the pie/table.
  const half = joint ? zvE / 2 : zvE;
  const out: { rate: number; amount: number; tax: number }[] = [];
  const sampleCount = 20;
  let lastIncome = 0;
  let lastTax = joint ? 2 * grundtarif(half) : grundtarif(half);
  for (let i = 1; i <= sampleCount; i++) {
    const inc = (half * i) / sampleCount;
    const tax = joint ? 2 * grundtarif(inc) : grundtarif(inc);
    const dInc = inc - lastIncome;
    const dTax = tax - lastTax;
    if (dInc > 0 && dTax > 0) {
      const rate = dTax / dInc;
      out.push({ rate, amount: dInc, tax: dTax });
    }
    lastIncome = inc;
    lastTax = tax;
  }
  return out;
}

export function computeGermanTax(input: GermanTaxInput): GermanTaxResult {
  const gross = Math.max(0, input.grossIncome || 0);
  const extraDed = Math.max(0, input.otherDeductions || 0);
  const joint = input.status === 'married';

  // Taxable income estimate: gross minus flat work-expense allowance and other deductions.
  const taxableFull = Math.max(0, gross - WERBUNGSKOSTEN_PAUSCHBETRAG - extraDed);

  let incomeTax: number;
  if (joint) {
    // Splittingverfahren: tax = 2 * grundtarif(half of joint taxable income)
    incomeTax = 2 * grundtarif(taxableFull / 2);
  } else {
    incomeTax = grundtarif(taxableFull);
  }
  incomeTax = Math.max(0, Math.floor(incomeTax + 0.5));

  // Soli: based on tarifliche Einkommensteuer vs Freigrenze.
  const soliF = joint ? SOLI_FREIGRENZE_JOINT : SOLI_FREIGRENZE_SINGLE;
  let soli = 0;
  if (incomeTax > soliF) {
    soli = Math.min(SOLI_RATE * incomeTax, SOLI_RELIEF_RATE * (incomeTax - soliF));
  }

  // Church tax (Kirchensteuer): percentage of income tax.
  const churchTax = input.churchTaxRate > 0 ? incomeTax * input.churchTaxRate : 0;

  const totalTax = incomeTax + soli + churchTax;
  const takeHome = gross - totalTax;
  const effectiveRate = gross > 0 ? totalTax / gross : 0;
  const marginal = marginalRate((x) => grundtarif(x), joint ? taxableFull / 2 : taxableFull);

  return {
    grossIncome: gross,
    taxableIncome: taxableFull,
    incomeTax,
    soli,
    churchTax,
    totalTax,
    marginalRate: marginal,
    effectiveRate,
    takeHome,
    slices: slicesFromBrackets(taxableFull, joint),
  };
}
