import { describe, it, expect } from 'vitest';
import {
  BRACKETS,
  computeFica,
  computeSeTax,
  computeUsTax,
  STANDARD_DEDUCTION,
  type UsTaxInput,
} from '../../src/tools/financial/us-income-tax-calculator/usTax';

function tax(input: UsTaxInput) {
  return computeUsTax(input);
}

const base: UsTaxInput = {
  status: 'single',
  wages: 80000,
  selfEmploymentIncome: 0,
  otherIncome: 0,
  useStandardDeduction: true,
  itemizedDeduction: 0,
};

describe('computeFica', () => {
  it('applies Social Security and Medicare below the wage base', () => {
    // 80000 wages: SS 6.2% + Medicare 1.45%, no additional
    expect(computeFica(80000)).toBeCloseTo(80000 * 0.062 + 80000 * 0.0145, 6);
  });

  it('caps Social Security at the wage base', () => {
    // 250000 wages -> SS capped at 168600, additional Medicare on >200000
    const expected = 168600 * 0.062 + 250000 * 0.0145 + (250000 - 200000) * 0.009;
    expect(computeFica(250000)).toBeCloseTo(expected, 6);
  });

  it('returns 0 for zero or negative wages', () => {
    expect(computeFica(0)).toBe(0);
    expect(computeFica(-1000)).toBe(0);
  });
});

describe('computeSeTax', () => {
  it('computes SE tax on 92.35% of net SE income under the SS cap', () => {
    const r = computeSeTax(100000);
    const taxable = 100000 * 0.9235;
    expect(r.taxable).toBeCloseTo(taxable, 6);
    expect(r.ssPortion).toBeCloseTo(taxable * 0.124, 6);
    expect(r.medicarePortion).toBeCloseTo(taxable * 0.029, 6);
    expect(r.additionalMedicare).toBe(0);
    expect(r.total).toBeCloseTo(r.ssPortion + r.medicarePortion, 6);
    expect(r.deductibleHalf).toBeCloseTo(r.total / 2, 6);
  });

  it('caps the Social Security portion at the wage base', () => {
    const r = computeSeTax(300000);
    const taxable = 300000 * 0.9235;
    expect(r.ssPortion).toBeCloseTo(168600 * 0.124, 6);
    expect(r.additionalMedicare).toBeCloseTo((taxable - 200000) * 0.009, 6);
  });

  it('returns zeros for no self-employment income', () => {
    const r = computeSeTax(0);
    expect(r.total).toBe(0);
    expect(r.deductibleHalf).toBe(0);
  });

  it('reduces the SE Social Security base by wages already subject to SS', () => {
    // 150k wages exhaust most of the wage base; remaining = 18600.
    const r = computeSeTax(50000, 150000);
    const taxable = 50000 * 0.9235; // 46175
    expect(r.ssPortion).toBeCloseTo(Math.min(taxable, 18600) * 0.124, 6);
  });

  it('charges no SE Social Security when wages already reach the wage base', () => {
    const r = computeSeTax(50000, 200000);
    expect(r.ssPortion).toBe(0);
    // Medicare still applies
    const taxable = 50000 * 0.9235;
    expect(r.medicarePortion).toBeCloseTo(taxable * 0.029, 6);
  });

  it('applies the combined Additional Medicare threshold for mixed earners', () => {
    // 150k wages + 150k SE -> combined 288525 (wages 150k + SE taxable 138525)
    // exceeds 200k; wage-side additional = 0 (wages < 200k), so SE carries it all.
    const r = computeSeTax(150000, 150000);
    const seTaxable = 150000 * 0.9235;
    const combined = 150000 + seTaxable;
    const expected = (combined - 200000) * 0.009;
    expect(r.additionalMedicare).toBeCloseTo(expected, 6);
  });

  it('splits Additional Medicare between wages and SE for high combined income', () => {
    // 250k wages (employer withholds 0.9% on 50k) + 100k SE.
    const r = computeSeTax(100000, 250000);
    const seTaxable = 100000 * 0.9235;
    const combined = 250000 + seTaxable;
    const totalAdditional = (combined - 200000) * 0.009;
    const wagesAdditional = (250000 - 200000) * 0.009;
    expect(r.additionalMedicare).toBeCloseTo(totalAdditional - wagesAdditional, 6);
  });
});

describe('computeUsTax — federal income tax', () => {
  it('taxes 80k single wages correctly across brackets', () => {
    const r = tax(base);
    // taxable = 80000 - 14600 = 65400
    expect(r.taxableIncome).toBe(65400);
    const expected =
      11600 * 0.10 + (47150 - 11600) * 0.12 + (65400 - 47150) * 0.22;
    expect(r.incomeTaxBeforeCredits).toBeCloseTo(expected, 6);
    expect(r.marginalRate).toBe(0.22);
  });

  it('uses the standard deduction for the chosen filing status', () => {
    const r = tax({ ...base, status: 'mfj', wages: 80000 });
    expect(r.deductionUsed).toBe(STANDARD_DEDUCTION.mfj);
    expect(r.taxableIncome).toBe(80000 - STANDARD_DEDUCTION.mfj);
  });

  it('uses itemized deduction when standard is disabled', () => {
    const r = tax({ ...base, useStandardDeduction: false, itemizedDeduction: 20000 });
    expect(r.deductionUsed).toBe(20000);
    expect(r.taxableIncome).toBe(80000 - 20000);
  });

  it('does not let taxable income go negative', () => {
    const r = tax({ ...base, wages: 10000 });
    expect(r.taxableIncome).toBe(0);
    expect(r.incomeTaxBeforeCredits).toBe(0);
  });

  it('computes total tax, effective rate, and take-home', () => {
    const r = tax(base);
    const fica = computeFica(80000);
    expect(r.fica).toBeCloseTo(fica, 6);
    expect(r.seTax.total).toBe(0);
    expect(r.totalTax).toBeCloseTo(r.incomeTaxBeforeCredits + fica, 6);
    expect(r.effectiveRate).toBeCloseTo(r.totalTax / 80000, 6);
    expect(r.takeHome).toBeCloseTo(80000 - r.totalTax, 6);
  });

  it('deducts half of SE tax from AGI', () => {
    const r = tax({ ...base, wages: 0, selfEmploymentIncome: 100000 });
    const se = computeSeTax(100000);
    expect(r.seTax.total).toBeCloseTo(se.total, 6);
    // AGI = SE income - half SE tax
    expect(r.agi).toBeCloseTo(100000 - se.deductibleHalf, 6);
  });

  it('handles the top 37% bracket for high earners', () => {
    const r = tax({ ...base, wages: 1000000 });
    expect(r.marginalRate).toBe(0.37);
    const last = r.bracketSlices[r.bracketSlices.length - 1];
    expect(last.rate).toBe(0.37);
  });

  it('bracket slices sum to the income tax', () => {
    const r = tax({ ...base, wages: 250000 });
    const sum = r.bracketSlices.reduce((s, b) => s + b.tax, 0);
    expect(sum).toBeCloseTo(r.incomeTaxBeforeCredits, 6);
  });

  it('treats other income as taxable but not subject to FICA', () => {
    const r = tax({ ...base, wages: 0, otherIncome: 50000 });
    expect(r.fica).toBe(0);
    expect(r.grossIncome).toBe(50000);
    expect(r.taxableIncome).toBe(Math.max(0, 50000 - STANDARD_DEDUCTION.single));
  });

  it('returns zero tax for zero income', () => {
    const r = tax({ ...base, wages: 0, otherIncome: 0, selfEmploymentIncome: 0 });
    expect(r.totalTax).toBe(0);
    expect(r.effectiveRate).toBe(0);
    expect(r.takeHome).toBe(0);
  });
});

describe('BRACKETS structure', () => {
  it('has increasing rates and a final Infinity bracket for each status', () => {
    for (const status of ['single', 'mfj', 'hoh'] as const) {
      const bs = BRACKETS[status];
      for (let i = 1; i < bs.length; i++) {
        expect(bs[i].rate).toBeGreaterThan(bs[i - 1].rate);
      }
      expect(bs[bs.length - 1].upTo).toBe(Infinity);
    }
  });
});
