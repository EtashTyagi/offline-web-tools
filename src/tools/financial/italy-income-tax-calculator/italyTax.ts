// Italy personal income tax (IRPEF) engine for tax year 2025.
// Source: Agenzia delle Entrate / Legge di Bilancio 2025 (IRPEF scaglioni 2025).
// National IRPEF plus regional and municipal surtaxes (addizionali).

export const TAX_YEAR_LABEL = '2025';

// National IRPEF brackets (2025).
export const BRACKETS: { rate: number; upTo: number }[] = [
  { rate: 0.23, upTo: 28000 },
  { rate: 0.35, upTo: 50000 },
  { rate: 0.43, upTo: Infinity },
];

export const REGIONAL_RATE_MIN = 0.0123;
export const REGIONAL_RATE_MAX = 0.0333;
export const REGIONAL_RATE_DEFAULT = 0.014; // typical default

export const MUNICIPAL_RATE_MAX = 0.009;
export const MUNICIPAL_RATE_DEFAULT = 0.008;

export interface ItalyTaxInput {
  taxableIncome: number; // reddito complessivo net of deductible expenses
  regionalRate: number; // addizionale regionale (fraction)
  municipalRate: number; // addizionale comunale (fraction)
}

export interface ItalyTaxResult {
  taxableIncome: number;
  nationalIrpef: number;
  regionalTax: number;
  municipalTax: number;
  totalTax: number;
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

export function computeItalyTax(input: ItalyTaxInput): ItalyTaxResult {
  const base = Math.max(0, input.taxableIncome || 0);
  const regionalRate = Math.min(REGIONAL_RATE_MAX, Math.max(REGIONAL_RATE_MIN, input.regionalRate || 0));
  const municipalRate = Math.min(MUNICIPAL_RATE_MAX, Math.max(0, input.municipalRate || 0));

  const { tax: nationalIrpef, slices, marginal } = taxOnAmount(base);
  const regionalTax = base * regionalRate;
  const municipalTax = base * municipalRate;
  const totalTax = nationalIrpef + regionalTax + municipalTax;
  const effectiveRate = base > 0 ? totalTax / base : 0;

  return {
    taxableIncome: base,
    nationalIrpef,
    regionalTax,
    municipalTax,
    totalTax,
    marginalRate: marginal,
    effectiveRate,
    slices,
  };
}
