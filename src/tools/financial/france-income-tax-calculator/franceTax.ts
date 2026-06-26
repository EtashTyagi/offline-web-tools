// France income tax engine (impôt sur le revenu) for revenus 2025 (declared 2026).
// Source: art. 197 CGI (bareme IR 2026 sur revenus 2025), BOFiP, service-public.fr.
// Brackets are applied per "part" of quotient familial, then multiplied by parts.

export const TAX_YEAR_LABEL = '2025 (revenus 2025)';

export const BRACKETS: { rate: number; upTo: number }[] = [
  { rate: 0.0, upTo: 11600 },
  { rate: 0.11, upTo: 29579 },
  { rate: 0.30, upTo: 84577 },
  { rate: 0.41, upTo: 181917 },
  { rate: 0.45, upTo: Infinity },
];

// Quotient familial capping: max tax saving per supplementary half-part (revenus 2025).
export const QF_CAP_PER_HALF_PART = 1807;

// 10% frais professionnels (salaried) deduction, revenus 2025.
export const ABATTEMENT_10_MIN = 509;
export const ABATTEMENT_10_MAX = 14555;

// Décote (revenus 2025).
export const DECOTE_SINGLE_FORFAIT = 897;
export const DECOTE_COUPLE_FORFAIT = 1483;
export const DECOTE_RATE = 0.4525;
export const DECOTE_SINGLE_THRESHOLD = 1982;
export const DECOTE_COUPLE_THRESHOLD = 3277;

export type FrenchHousehold =
  | 'single'
  | 'couple'
  | 'single1'
  | 'single2'
  | 'couple1'
  | 'couple2'
  | 'couple3';

export const HOUSEHOLDS: { value: FrenchHousehold; label: string; parts: number; baseParts: number }[] = [
  { value: 'single', label: 'Single', parts: 1, baseParts: 1 },
  { value: 'couple', label: 'Married / PACS couple', parts: 2, baseParts: 2 },
  { value: 'single1', label: 'Single, 1 child', parts: 1.5, baseParts: 1 },
  { value: 'single2', label: 'Single, 2 children', parts: 2, baseParts: 1 },
  { value: 'couple1', label: 'Couple, 1 child', parts: 2.5, baseParts: 2 },
  { value: 'couple2', label: 'Couple, 2 children', parts: 3, baseParts: 2 },
  { value: 'couple3', label: 'Couple, 3 children', parts: 4, baseParts: 2 },
];

export interface FrenchTaxInput {
  salariedIncome: number;
  otherIncome: number;
  household: FrenchHousehold;
  useAbatement: boolean; // 10% frais professionnels on salaried income
}

export interface FrenchTaxResult {
  parts: number;
  baseParts: number;
  revenuNetImposable: number;
  incomeBeforeDecote: number; // after QF capping, before décote
  qfCap: number; // extra tax due to quotient familial capping (reconciles slices -> incomeBeforeDecote)
  decote: number;
  incomeTax: number;
  effectiveRate: number;
  marginalRate: number;
  slices: { rate: number; amount: number; tax: number }[];
}

function householdConfig(h: FrenchHousehold) {
  return HOUSEHOLDS.find((x) => x.value === h) ?? HOUSEHOLDS[0];
}

function taxOnOnePart(revenuPerPart: number): {
  tax: number;
  slices: { rate: number; amount: number; tax: number }[];
  marginal: number;
} {
  const slices: { rate: number; amount: number; tax: number }[] = [];
  let remaining = Math.max(0, revenuPerPart);
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
      if (b.rate > 0) marginal = b.rate;
    }
    remaining -= inBracket;
    last = b.upTo;
  }
  return { tax, slices, marginal };
}

export function computeFrenchTax(input: FrenchTaxInput): FrenchTaxResult {
  const cfg = householdConfig(input.household);
  const salaried = Math.max(0, input.salariedIncome || 0);
  const other = Math.max(0, input.otherIncome || 0);

  let abatement = 0;
  if (input.useAbatement && salaried > 0) {
    abatement = Math.min(ABATTEMENT_10_MAX, Math.max(ABATTEMENT_10_MIN, salaried * 0.1));
    if (salaried < ABATTEMENT_10_MIN) abatement = salaried;
  }
  const revenuNetImposable = Math.max(0, salaried - abatement + other);

  const parts = cfg.parts;
  const baseParts = cfg.baseParts;

  // Tax with full parts (per-part calc).
  const perPart = revenuNetImposable / parts;
  const fullResult = taxOnOnePart(perPart);
  const taxWithParts = fullResult.tax * parts;

  // Tax with base parts only (for QF capping).
  const basePerPart = revenuNetImposable / baseParts;
  const taxWithBase = taxOnOnePart(basePerPart).tax * baseParts;

  // QF capping: the gain from extra half-parts is capped.
  const nbHalfParts = Math.round((parts - baseParts) * 2);
  let incomeAfterQF: number;
  if (nbHalfParts > 0) {
    const gain = taxWithBase - taxWithParts;
    const maxGain = nbHalfParts * QF_CAP_PER_HALF_PART;
    incomeAfterQF = gain > maxGain ? taxWithBase - maxGain : taxWithParts;
  } else {
    incomeAfterQF = taxWithParts;
  }

  // Décote.
  const isCouple = baseParts >= 2;
  const decoteForfait = isCouple ? DECOTE_COUPLE_FORFAIT : DECOTE_SINGLE_FORFAIT;
  const decoteThreshold = isCouple ? DECOTE_COUPLE_THRESHOLD : DECOTE_SINGLE_THRESHOLD;
  let decote = 0;
  if (incomeAfterQF > 0 && incomeAfterQF < decoteThreshold) {
    decote = Math.max(0, decoteForfait - DECOTE_RATE * incomeAfterQF);
  }
  const incomeTax = Math.max(0, incomeAfterQF - decote);

  const effectiveRate = revenuNetImposable > 0 ? incomeTax / (salaried + other) : 0;

  // Marginal rate: the rate of the bracket that contains per-part income.
  let marginal = 0;
  for (const b of BRACKETS) {
    marginal = b.rate;
    if (perPart <= b.upTo) break;
  }

  // Slices for display: total per bracket across all parts.
  const slices = fullResult.slices.map((s) => ({
    rate: s.rate,
    amount: s.amount * parts,
    tax: s.tax * parts,
  }));

  // QF capping adds tax on top of the bracket slices; this reconciles them.
  const slicesSum = slices.reduce((s, b) => s + b.tax, 0);
  const qfCap = Math.max(0, incomeAfterQF - slicesSum);

  return {
    parts,
    baseParts,
    revenuNetImposable,
    incomeBeforeDecote: incomeAfterQF,
    qfCap,
    decote,
    incomeTax,
    effectiveRate,
    marginalRate: marginal,
    slices,
  };
}
