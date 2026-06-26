import { describe, it, expect } from 'vitest';
import {
  computeFrenchTax,
  QF_CAP_PER_HALF_PART,
} from '../../src/tools/financial/france-income-tax-calculator/franceTax';

describe('France IR brackets', () => {
  it('taxes a single salary of €40,000 with the 10% abatement', () => {
    const r = computeFrenchTax({ salariedIncome: 40000, otherIncome: 0, household: 'single', useAbatement: true });
    // abatement = 4000 (between 509 and 14555); net imposable = 36000
    expect(r.revenuNetImposable).toBe(36000);
    // per part = 36000; tax = 0%*11600 + 11%*(29579-11600) + 30%*(36000-29579)
    const expected = 0.11 * (29579 - 11600) + 0.3 * (36000 - 29579);
    expect(r.incomeBeforeDecote).toBeCloseTo(expected, 1);
  });

  it('skips the abatement when disabled', () => {
    const r = computeFrenchTax({ salariedIncome: 40000, otherIncome: 0, household: 'single', useAbatement: false });
    expect(r.revenuNetImposable).toBe(40000);
  });

  it('caps the 10% abatement at €14,555', () => {
    const r = computeFrenchTax({ salariedIncome: 300000, otherIncome: 0, household: 'single', useAbatement: true });
    expect(r.revenuNetImposable).toBe(300000 - 14555);
  });

  it('floors the 10% abatement at €509 when 10% of salary is below it', () => {
    // 10% of 4000 = 400, below the 509 floor -> abatement floored to 509
    const r = computeFrenchTax({ salariedIncome: 4000, otherIncome: 0, household: 'single', useAbatement: true });
    expect(r.revenuNetImposable).toBe(4000 - 509);
  });

  it('uses 10% of salary when it exceeds the floor', () => {
    const r = computeFrenchTax({ salariedIncome: 15000, otherIncome: 0, household: 'single', useAbatement: true });
    expect(r.revenuNetImposable).toBe(15000 - 1500);
  });
});

describe('France marginal rate', () => {
  it('reports 0% marginal rate for income within the 0% bracket', () => {
    // couple with €20k income = €10k/part, fully in the 0% bracket (≤11600)
    const r = computeFrenchTax({ salariedIncome: 20000, otherIncome: 0, household: 'couple', useAbatement: false });
    expect(r.incomeTax).toBe(0);
    expect(r.marginalRate).toBe(0);
  });

  it('reports 11% marginal rate just above the 0% bracket', () => {
    // couple €24k = €12k/part -> first bracket (0%, ≤11600) then 11%
    const r = computeFrenchTax({ salariedIncome: 24000, otherIncome: 0, household: 'couple', useAbatement: false });
    expect(r.marginalRate).toBe(0.11);
  });

  it('reports 45% marginal rate for very high income', () => {
    const r = computeFrenchTax({ salariedIncome: 500000, otherIncome: 0, household: 'single', useAbatement: false });
    expect(r.marginalRate).toBe(0.45);
  });
});

describe('France quotient familial', () => {
  it('divides income by parts before applying brackets', () => {
    const single = computeFrenchTax({ salariedIncome: 100000, otherIncome: 0, household: 'single', useAbatement: false });
    const couple = computeFrenchTax({ salariedIncome: 100000, otherIncome: 0, household: 'couple', useAbatement: false });
    expect(couple.incomeTax).toBeLessThan(single.incomeTax);
  });

  it('caps the family-quotient benefit at €1,807 per half-part', () => {
    const base = computeFrenchTax({ salariedIncome: 400000, otherIncome: 0, household: 'couple', useAbatement: false });
    const withKids = computeFrenchTax({ salariedIncome: 400000, otherIncome: 0, household: 'couple2', useAbatement: false });
    // 2 children = 2 supplementary half-parts; max gain = 2 * 1807
    const gain = base.incomeBeforeDecote - withKids.incomeBeforeDecote;
    expect(gain).toBeLessThanOrEqual(2 * QF_CAP_PER_HALF_PART + 1);
  });
});

describe('France décote', () => {
  it('applies the décote for modest incomes and reduces tax', () => {
    const r = computeFrenchTax({ salariedIncome: 25000, otherIncome: 0, household: 'single', useAbatement: false });
    expect(r.decote).toBeGreaterThan(0);
    expect(r.incomeTax).toBeLessThan(r.incomeBeforeDecote);
  });

  it('applies no décote for high incomes', () => {
    const r = computeFrenchTax({ salariedIncome: 200000, otherIncome: 0, household: 'single', useAbatement: false });
    expect(r.decote).toBe(0);
  });
});

describe('France slices and effective rate', () => {
  it('bracket slices sum to the gross tax', () => {
    const r = computeFrenchTax({ salariedIncome: 90000, otherIncome: 0, household: 'couple', useAbatement: false });
    const sum = r.slices.reduce((s, b) => s + b.tax, 0);
    expect(sum).toBeCloseTo(r.incomeBeforeDecote, 1);
  });

  it('qfCap reconciles slices with incomeBeforeDecote when capping bites', () => {
    const r = computeFrenchTax({ salariedIncome: 400000, otherIncome: 0, household: 'couple2', useAbatement: false });
    const slicesSum = r.slices.reduce((s, b) => s + b.tax, 0);
    expect(slicesSum + r.qfCap).toBeCloseTo(r.incomeBeforeDecote, 1);
    expect(r.qfCap).toBeGreaterThan(0);
  });

  it('qfCap is zero when capping does not apply', () => {
    const r = computeFrenchTax({ salariedIncome: 90000, otherIncome: 0, household: 'couple', useAbatement: false });
    expect(r.qfCap).toBe(0);
  });

  it('returns zero tax for zero income', () => {
    const r = computeFrenchTax({ salariedIncome: 0, otherIncome: 0, household: 'single', useAbatement: false });
    expect(r.incomeTax).toBe(0);
  });
});
