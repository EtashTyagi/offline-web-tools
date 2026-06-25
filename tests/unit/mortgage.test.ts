import { describe, it, expect } from 'vitest';
import { compute } from '../../src/tools/financial/mortgage-calculator/MortgageCalculator';

describe('MortgageCalculator.compute', () => {
  it('computes the standard monthly payment', () => {
    // $100k at 5% for 30 years -> ~536.82
    const r = compute(100000, 5, 30);
    expect(r.monthly).toBeCloseTo(536.82, 1);
  });

  it('sums total paid = monthly * months', () => {
    const r = compute(100000, 5, 30);
    expect(r.totalPaid).toBeCloseTo(r.monthly * 360, 5);
  });

  it('computes total interest = totalPaid - loan', () => {
    const r = compute(100000, 5, 30);
    expect(r.totalInterest).toBeCloseTo(r.totalPaid - 100000, 5);
  });

  it('handles a zero interest rate (simple division)', () => {
    const r = compute(12000, 0, 1);
    expect(r.monthly).toBe(1000);
    expect(r.totalInterest).toBeCloseTo(0, 10);
  });

  it('produces one row per month', () => {
    const r = compute(50000, 6, 5);
    expect(r.rows).toHaveLength(60);
  });

  it('first row interest equals principal * monthly rate', () => {
    const r = compute(50000, 6, 5);
    const monthlyRate = 0.06 / 12;
    expect(r.rows[0].interest).toBeCloseTo(50000 * monthlyRate, 5);
  });

  it('ends with a zero balance', () => {
    const r = compute(50000, 6, 5);
    expect(r.rows[r.rows.length - 1].balance).toBeCloseTo(0, 6);
  });

  it('cumulative principal equals loan amount at the end', () => {
    const r = compute(50000, 6, 5);
    expect(r.rows[r.rows.length - 1].cumPrincipal).toBeCloseTo(50000, 4);
  });

  it('cumulative interest equals totalInterest at the end', () => {
    const r = compute(50000, 6, 5);
    expect(r.rows[r.rows.length - 1].cumInterest).toBeCloseTo(r.totalInterest, 4);
  });

  it('keeps payment constant for a fixed-rate loan', () => {
    const r = compute(200000, 4.5, 15);
    const first = r.rows[0].payment;
    for (const row of r.rows) expect(row.payment).toBeCloseTo(first, 10);
  });
});
