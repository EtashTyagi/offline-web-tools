import { describe, it, expect } from 'vitest';
import {
  computeIndiaTax,
  EMPTY_DEDUCTIONS,
  type IndiaDeductions,
  type IndiaTaxInput,
} from '../../src/tools/financial/india-income-tax-calculator/indiaTax';

function input(gross: number, deductions: IndiaDeductions = EMPTY_DEDUCTIONS, other = 0): IndiaTaxInput {
  return { grossSalary: gross, otherIncome: other, deductions };
}

describe('IndiaTax — New regime', () => {
  it('taxes 12L salary with the new-regime slabs, standard deduction, and cess', () => {
    const r = computeIndiaTax(input(1200000));
    // taxable = 1200000 - 75000 = 1125000
    expect(r.newRegime.taxableIncome).toBe(1125000);
    const expected =
      0 * 300000 +
      0.05 * 400000 +
      0.10 * 300000 +
      0.15 * 125000; // 68750
    expect(r.newRegime.taxBeforeRebate).toBeCloseTo(expected, 6);
    expect(r.newRegime.rebate).toBe(0); // above 7L threshold
    expect(r.newRegime.cess).toBeCloseTo(expected * 0.04, 6);
    expect(r.newTotalTax).toBeCloseTo(expected * 1.04, 6);
  });

  it('applies the 87A rebate for new-regime taxable income up to 7L', () => {
    // gross 700000 -> taxable 625000 -> tax 5% on 325000 = 16250, rebated fully
    const r = computeIndiaTax(input(700000));
    expect(r.newRegime.taxableIncome).toBe(625000);
    expect(r.newRegime.taxBeforeRebate).toBeCloseTo(0.05 * 325000, 6);
    expect(r.newRegime.rebate).toBeCloseTo(r.newRegime.taxBeforeRebate, 6);
    expect(r.newTotalTax).toBe(0);
  });

  it('charges nothing in the 0% slab up to 3L (after standard deduction)', () => {
    // gross 75000 (equal to std deduction) -> taxable 0
    const r = computeIndiaTax(input(75000));
    expect(r.newRegime.taxableIncome).toBe(0);
    expect(r.newTotalTax).toBe(0);
  });

  it('applies the 30% top slab for very high income', () => {
    const r = computeIndiaTax(input(5000000));
    const last = r.newRegime.slices[r.newRegime.slices.length - 1];
    expect(last.rate).toBe(0.30);
  });
});

describe('IndiaTax — Old regime', () => {
  it('taxes 12L salary with old-regime slabs and no deductions', () => {
    const r = computeIndiaTax(input(1200000));
    // taxable = 1200000 - 50000 = 1150000
    expect(r.oldRegime.taxableIncome).toBe(1150000);
    const expected =
      0 * 250000 +
      0.05 * 250000 +
      0.20 * 500000 +
      0.30 * 150000; // 157500
    expect(r.oldRegime.taxBeforeRebate).toBeCloseTo(expected, 6);
    expect(r.oldTotalTax).toBeCloseTo(expected * 1.04, 6);
  });

  it('applies chapter VI-A deductions (80C, 80D, NPS) with caps', () => {
    const d: IndiaDeductions = {
      section80C: 200000, // capped to 150000
      section80D: 60000, // capped to 25000
      section80CCD1B: 80000, // capped to 50000
      hraExempted: 100000,
      homeLoanInterest: 300000, // capped to 200000
      other: 10000,
    };
    const r = computeIndiaTax(input(2000000, d));
    // std 50000 + 150000 + 25000 + 50000 + 100000 + 200000 + 10000 = 585000
    const totalDed = 50000 + 150000 + 25000 + 50000 + 100000 + 200000 + 10000;
    expect(r.oldRegime.taxableIncome).toBe(2000000 - totalDed);
  });

  it('applies the 87A rebate for old-regime taxable income up to 5L', () => {
    // gross 500000 -> taxable 450000 -> 5% on 200000 = 10000, rebated fully
    const r = computeIndiaTax(input(500000));
    expect(r.oldRegime.taxableIncome).toBe(450000);
    expect(r.oldRegime.taxBeforeRebate).toBeCloseTo(0.05 * 200000, 6);
    expect(r.oldRegime.rebate).toBeCloseTo(r.oldRegime.taxBeforeRebate, 6);
    expect(r.oldTotalTax).toBe(0);
  });

  it('clamps negative deduction inputs to zero', () => {
    const d: IndiaDeductions = {
      section80C: -50000,
      section80D: -1000,
      section80CCD1B: -200,
      hraExempted: -300,
      homeLoanInterest: -100,
      other: -50,
    };
    const r = computeIndiaTax(input(800000, d));
    expect(r.oldRegime.taxableIncome).toBe(800000 - 50000);
  });
});

describe('IndiaTax — recommendation', () => {
  it('recommends the regime with lower total tax', () => {
    const r = computeIndiaTax(input(1200000));
    expect(r.newTotalTax).toBeLessThan(r.oldTotalTax);
    expect(r.recommended).toBe('new');
  });

  it('suggests the old regime when deductions make it cheaper', () => {
    const d: IndiaDeductions = {
      ...EMPTY_DEDUCTIONS,
      section80C: 150000,
      section80D: 25000,
      section80CCD1B: 50000,
      homeLoanInterest: 200000,
      hraExempted: 200000,
    };
    const r = computeIndiaTax(input(2000000, d));
    expect(r.oldTotalTax).toBeLessThan(r.newTotalTax);
    expect(r.recommended).toBe('old');
  });

  it('reports the savings between regimes', () => {
    const r = computeIndiaTax(input(1200000));
    expect(r.newTotalTax - r.oldTotalTax).toBeLessThan(0);
  });

  it('handles zero income cleanly', () => {
    const r = computeIndiaTax(input(0));
    expect(r.newTotalTax).toBe(0);
    expect(r.oldTotalTax).toBe(0);
  });
});
