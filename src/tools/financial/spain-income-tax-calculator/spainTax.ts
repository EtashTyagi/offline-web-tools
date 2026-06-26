// Spain personal income tax (IRPF) engine for fiscal year 2025.
// Source: Agencia Tributaria / Ley del IRPF state withholding scale 2025.
// The combined (state + common-regional) withholding brackets are used as the
// general scale; regional rates vary by autonomous community and are not modelled.
// Savings income (ahorro) is taxed separately and is not included here.

export const TAX_YEAR_LABEL = '2025 (ejercicio 2025)';

// Combined state + common-territory regional scale (2025).
export const BRACKETS: { rate: number; upTo: number }[] = [
  { rate: 0.19, upTo: 12450 },
  { rate: 0.24, upTo: 20200 },
  { rate: 0.30, upTo: 35200 },
  { rate: 0.37, upTo: 60000 },
  { rate: 0.45, upTo: 300000 },
  { rate: 0.47, upTo: Infinity },
];

export const MINIMO_PERSONAL = 5550; // taxpayer personal minimum, 2025

export interface SpainTaxInput {
  generalIncome: number; // general taxable income (salary, self-employment, etc.)
  deductibleExpenses: number; // social security, expenses reducing the base
}

export interface SpainTaxResult {
  taxableBase: number; // after deductible expenses
  reducedBase: number; // after personal minimum
  incomeTax: number;
  marginalRate: number;
  effectiveRate: number;
  slices: { rate: number; amount: number; tax: number }[];
}

function taxOnAmount(base: number): {
  tax: number;
  slices: { rate: number; amount: number; tax: number }[];
  marginal: number;
} {
  const slices: { rate: number; amount: number; tax: number }[] = [];
  let remaining = Math.max(0, base);
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

export function computeSpainTax(input: SpainTaxInput): SpainTaxResult {
  const income = Math.max(0, input.generalIncome || 0);
  const expenses = Math.max(0, input.deductibleExpenses || 0);
  const taxableBase = Math.max(0, income - expenses);
  // Spanish IRPF integrates the mínimo personal as a deduction from the cuota
  // (Art. 63 LIRPF): cuota = scale(base) - scale(mínimo), not base - mínimo.
  const fullResult = taxOnAmount(taxableBase);
  const minResult = taxOnAmount(Math.min(MINIMO_PERSONAL, taxableBase));
  const tax = Math.max(0, fullResult.tax - minResult.tax);

  const effectiveRate = income > 0 ? tax / income : 0;
  return {
    taxableBase,
    reducedBase: Math.max(0, taxableBase - MINIMO_PERSONAL),
    incomeTax: tax,
    marginalRate: fullResult.marginal,
    effectiveRate,
    slices: fullResult.slices,
  };
}
