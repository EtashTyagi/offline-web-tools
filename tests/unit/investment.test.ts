import { describe, it, expect } from 'vitest';
import { computeInvestment } from '../../src/tools/financial/investment-calculator/InvestmentCalculator';

describe('InvestmentCalculator.computeInvestment', () => {
  it('grows a lump sum with no contributions', () => {
    // 100k at 12% for 1 year, monthly compounding, no contributions
    const r = computeInvestment(100000, 12, 1, []);
    const expected = 100000 * Math.pow(1 + 0.12 / 12, 12);
    expect(r.finalBalance).toBeCloseTo(expected, 2);
    expect(r.totalInterest).toBeCloseTo(expected - 100000, 2);
    expect(r.totalContributions).toBe(100000);
  });

  it('handles a zero interest rate (no growth)', () => {
    const r = computeInvestment(50000, 0, 1, [{ amount: 1000, freq: 12 }]);
    // lump 50k + 12 * 1000 monthly contributions
    expect(r.finalBalance).toBeCloseTo(50000 + 12000, 5);
    expect(r.totalInterest).toBeCloseTo(0, 10);
  });

  it('produces one row per month', () => {
    const r = computeInvestment(1000, 6, 5, [{ amount: 100, freq: 12 }]);
    expect(r.rows).toHaveLength(60);
  });

  it('applies monthly contributions every month', () => {
    const r = computeInvestment(0, 0, 1, [{ amount: 500, freq: 12 }]);
    for (const row of r.rows) {
      expect(row.contribution).toBe(500);
    }
  });

  it('applies annual contributions only in month 12', () => {
    const r = computeInvestment(0, 0, 1, [{ amount: 10000, freq: 1 }]);
    // contributions only at month 12 (step = 12)
    expect(r.rows[0].contribution).toBe(0);
    expect(r.rows[10].contribution).toBe(0);
    expect(r.rows[11].contribution).toBe(10000);
  });

  it('applies quarterly contributions every 3 months', () => {
    const r = computeInvestment(0, 0, 1, [{ amount: 1000, freq: 4 }]);
    expect(r.rows[0].contribution).toBe(0); // month 1
    expect(r.rows[1].contribution).toBe(0); // month 2
    expect(r.rows[2].contribution).toBe(1000); // month 3
    expect(r.rows[5].contribution).toBe(1000); // month 6
    expect(r.rows[11].contribution).toBe(1000); // month 12
  });

  it('combines multiple contribution streams', () => {
    const r = computeInvestment(0, 0, 1, [
      { amount: 30000, freq: 12 },
      { amount: 50000, freq: 1 },
    ]);
    // 12 monthly of 30k = 360k + one annual 50k at month 12 = 410k total
    const totalContrib = r.rows.reduce((s, row) => s + row.contribution, 0);
    expect(totalContrib).toBeCloseTo(12 * 30000 + 50000, 5);
    expect(r.finalBalance).toBeCloseTo(410000, 5);
  });

  it('accumulates cumulative contributions and interest correctly', () => {
    const r = computeInvestment(10000, 10, 2, [{ amount: 1000, freq: 12 }]);
    const totalContrib = 10000 + 24 * 1000;
    expect(r.totalContributions).toBeCloseTo(totalContrib, 5);
    expect(r.totalInterest).toBeCloseTo(r.finalBalance - totalContrib, 5);
    expect(r.rows[r.rows.length - 1].cumContribution).toBeCloseTo(24 * 1000, 5);
    expect(r.rows[r.rows.length - 1].cumInterest).toBeCloseTo(r.totalInterest, 2);
  });

  it('first row interest equals lump sum * monthly rate', () => {
    const r = computeInvestment(50000, 6, 1, []);
    const monthlyRate = 0.06 / 12;
    expect(r.rows[0].interest).toBeCloseTo(50000 * monthlyRate, 5);
  });

  it('ignores zero-amount and invalid contribution streams', () => {
    const r1 = computeInvestment(1000, 5, 1, [{ amount: 0, freq: 12 }]);
    const r2 = computeInvestment(1000, 5, 1, []);
    expect(r1.finalBalance).toBeCloseTo(r2.finalBalance, 5);
  });

  it('compounds balance month over month', () => {
    const r = computeInvestment(1000, 12, 1, []);
    const monthlyRate = 0.12 / 12;
    let bal = 1000;
    for (const row of r.rows) {
      bal = bal * (1 + monthlyRate);
      expect(row.balance).toBeCloseTo(bal, 5);
    }
  });
});
