import { describe, it, expect } from 'vitest';
import {
  computeGermanTax,
  GRUNDFREIBETRAG,
  SOLI_FREIGRENZE_SINGLE,
  SOLI_FREIGRENZE_JOINT,
} from '../../src/tools/financial/germany-income-tax-calculator/germanyTax';

describe('Germany §32a tariff', () => {
  it('charges zero tax up to the Grundfreibetrag', () => {
    const r = computeGermanTax({ grossIncome: GRUNDFREIBETRAG, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    expect(r.incomeTax).toBe(0);
    expect(r.soli).toBe(0);
  });

  it('matches the official table value for €50,000 single (~€10,691)', () => {
    const r = computeGermanTax({ grossIncome: 50000, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    // taxable = 50000 - 1230 = 48770; grundtarif(48770) approx 10148 -> close to table's 50k value scaled
    expect(r.incomeTax).toBeGreaterThan(9500);
    expect(r.incomeTax).toBeLessThan(11000);
  });

  it('matches official table for €80,000 single (€22,688)', () => {
    // Official Grundtabelle 2025 at zvE 80,000 -> tax 22,688 (before abatement).
    const r = computeGermanTax({ grossIncome: 80000, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    // taxable = 80000 - 1230 = 78770; expected tax ~ 22,200; table zvE 78,770 -> ~22,166
    expect(r.incomeTax).toBeGreaterThan(21500);
    expect(r.incomeTax).toBeLessThan(22800);
  });

  it('applies the splittingverfahren for married couples', () => {
    const single = computeGermanTax({ grossIncome: 60000, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    const joint = computeGermanTax({ grossIncome: 60000, status: 'married', churchTaxRate: 0, otherDeductions: 0 });
    expect(joint.incomeTax).toBeLessThan(single.incomeTax);
  });

  it('computes the joint marginal rate from the single tarif at the half point', () => {
    // Joint €100k: taxable = 100000 - 1230 = 98870, half = 49435.
    // The marginal must be grundtarif'(49435) ≈ 0.35, NOT 2× clamped to 0.45.
    const joint = computeGermanTax({ grossIncome: 100000, status: 'married', churchTaxRate: 0, otherDeductions: 0 });
    const halfTaxable = (100000 - 1230) / 2;
    // A single filer at gross = halfTaxable + 1230 has the same taxable base.
    const singleSameBase = computeGermanTax({ grossIncome: halfTaxable + 1230, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    expect(joint.marginalRate).toBeCloseTo(singleSameBase.marginalRate, 5);
    expect(joint.marginalRate).toBeLessThan(0.45);
    expect(joint.marginalRate).toBeGreaterThan(0.30);
  });
});

describe('Germany solidarity surcharge', () => {
  it('charges no Soli when income tax is below the Freigrenze', () => {
    const r = computeGermanTax({ grossIncome: 30000, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    expect(r.incomeTax).toBeLessThan(SOLI_FREIGRENZE_SINGLE);
    expect(r.soli).toBe(0);
  });

  it('charges Soli proportional to income tax above the Freigrenze', () => {
    const r = computeGermanTax({ grossIncome: 200000, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    expect(r.incomeTax).toBeGreaterThan(SOLI_FREIGRENZE_SINGLE);
    expect(r.soli).toBeCloseTo(0.055 * r.incomeTax, 2);
  });

  it('doubles the Soli Freigrenze for joint filers', () => {
    // Use a high joint income so income tax is well above the relief-zone
    // upper bound (~1.859375 * 39,900), making the full 5.5% Soli apply.
    const r = computeGermanTax({ grossIncome: 250000, status: 'married', churchTaxRate: 0, otherDeductions: 0 });
    expect(r.incomeTax).toBeGreaterThan(SOLI_FREIGRENZE_JOINT * 1.86);
    expect(r.soli).toBeCloseTo(0.055 * r.incomeTax, 2);
  });
});

describe('Germany church tax', () => {
  it('adds 9% church tax on income tax when selected', () => {
    const r = computeGermanTax({ grossIncome: 100000, status: 'single', churchTaxRate: 0.09, otherDeductions: 0 });
    expect(r.churchTax).toBeCloseTo(0.09 * r.incomeTax, 6);
  });

  it('omits church tax when rate is 0', () => {
    const r = computeGermanTax({ grossIncome: 100000, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    expect(r.churchTax).toBe(0);
  });
});

describe('Germany totals', () => {
  it('total tax = income tax + soli + church tax', () => {
    const r = computeGermanTax({ grossIncome: 150000, status: 'single', churchTaxRate: 0.09, otherDeductions: 0 });
    expect(r.totalTax).toBeCloseTo(r.incomeTax + r.soli + r.churchTax, 6);
    expect(r.takeHome).toBeCloseTo(150000 - r.totalTax, 6);
  });

  it('handles zero income', () => {
    const r = computeGermanTax({ grossIncome: 0, status: 'single', churchTaxRate: 0, otherDeductions: 0 });
    expect(r.incomeTax).toBe(0);
    expect(r.totalTax).toBe(0);
  });
});
