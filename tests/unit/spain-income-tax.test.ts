import { describe, it, expect } from 'vitest';
import { computeSpainTax, MINIMO_PERSONAL } from '../../src/tools/financial/spain-income-tax-calculator/spainTax';

function scale(base: number): number {
  const brackets = [
    { rate: 0.19, upTo: 12450 },
    { rate: 0.24, upTo: 20200 },
    { rate: 0.30, upTo: 35200 },
    { rate: 0.37, upTo: 60000 },
    { rate: 0.45, upTo: 300000 },
    { rate: 0.47, upTo: Infinity },
  ];
  let remaining = Math.max(0, base);
  let last = 0;
  let tax = 0;
  for (const b of brackets) {
    if (remaining <= 0) break;
    const inBracket = Math.min(remaining, b.upTo - last);
    tax += inBracket * b.rate;
    remaining -= inBracket;
    last = b.upTo;
  }
  return tax;
}

describe('Spain IRPF', () => {
  it('applies mínimo personal as scale(base) - scale(mínimo)', () => {
    const r = computeSpainTax({ generalIncome: 30000, deductibleExpenses: 0 });
    const expected = scale(30000) - scale(MINIMO_PERSONAL);
    expect(r.incomeTax).toBeCloseTo(expected, 6);
    expect(r.marginalRate).toBe(0.30);
  });

  it('crosses several brackets at high income', () => {
    const r = computeSpainTax({ generalIncome: 100000, deductibleExpenses: 0 });
    const expected = scale(100000) - scale(MINIMO_PERSONAL);
    expect(r.incomeTax).toBeCloseTo(expected, 6);
    expect(r.marginalRate).toBe(0.45);
  });

  it('applies the 47% top bracket above €300,000', () => {
    const r = computeSpainTax({ generalIncome: 400000, deductibleExpenses: 0 });
    expect(r.marginalRate).toBe(0.47);
  });

  it('subtracts deductible expenses from the base', () => {
    const a = computeSpainTax({ generalIncome: 50000, deductibleExpenses: 0 });
    const b = computeSpainTax({ generalIncome: 50000, deductibleExpenses: 5000 });
    expect(b.taxableBase).toBe(45000);
    expect(b.incomeTax).toBeLessThan(a.incomeTax);
  });

  it('charges no tax when income is within the personal minimum', () => {
    const r = computeSpainTax({ generalIncome: MINIMO_PERSONAL, deductibleExpenses: 0 });
    expect(r.incomeTax).toBeCloseTo(0, 6);
  });

  it('slices sum to the gross cuota (before mínimo deduction)', () => {
    const r = computeSpainTax({ generalIncome: 60000, deductibleExpenses: 0 });
    const sum = r.slices.reduce((s, b) => s + b.tax, 0);
    expect(sum).toBeCloseTo(scale(60000), 6);
  });

  it('computes effective rate against gross income', () => {
    const r = computeSpainTax({ generalIncome: 30000, deductibleExpenses: 0 });
    expect(r.effectiveRate).toBeCloseTo(r.incomeTax / 30000, 6);
  });
});
