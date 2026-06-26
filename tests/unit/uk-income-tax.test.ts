import { describe, it, expect } from 'vitest';
import {
  BASIC_BAND_TOP,
  computeNi,
  computeUkTax,
  HIGHER_BAND_TOP,
  NI_UPPER_EARNINGS_LIMIT,
  PERSONAL_ALLOWANCE,
  PA_TAPER_END,
} from '../../src/tools/financial/uk-income-tax-calculator/ukTax';

describe('computeNi', () => {
  it('charges 8% between PT and UEL, 2% above', () => {
    const r = computeNi(60000);
    const main = (NI_UPPER_EARNINGS_LIMIT - 12570) * 0.08;
    const additional = (60000 - NI_UPPER_EARNINGS_LIMIT) * 0.02;
    expect(r.mainTax).toBeCloseTo(main, 6);
    expect(r.additionalTax).toBeCloseTo(additional, 6);
    expect(r.total).toBeCloseTo(main + additional, 6);
  });

  it('returns 0 below the primary threshold', () => {
    expect(computeNi(12000).total).toBe(0);
    expect(computeNi(0).total).toBe(0);
  });
});

describe('computeUkTax — income tax', () => {
  it('applies the personal allowance and basic rate', () => {
    const r = computeUkTax({ grossIncome: 45000, pensionContributionsRelief: 0 });
    expect(r.personalAllowanceUsed).toBe(PERSONAL_ALLOWANCE);
    const taxable = 45000 - PERSONAL_ALLOWANCE;
    expect(r.taxableIncome).toBe(taxable);
    // all within basic band (<=37700)
    expect(r.incomeTax).toBeCloseTo(taxable * 0.2, 6);
    expect(r.marginalRate).toBe(0.2);
  });

  it('crosses into the higher rate', () => {
    const r = computeUkTax({ grossIncome: 80000, pensionContributionsRelief: 0 });
    const taxable = 80000 - PERSONAL_ALLOWANCE; // 67430
    const expected = BASIC_BAND_TOP * 0.2 + (taxable - BASIC_BAND_TOP) * 0.4;
    expect(r.incomeTax).toBeCloseTo(expected, 6);
    expect(r.marginalRate).toBe(0.4);
  });

  it('tapers the personal allowance above £100,000', () => {
    const r = computeUkTax({ grossIncome: 120000, pensionContributionsRelief: 0 });
    // PA reduced by (120000 - 100000)/2 = 10000 -> 12570 - 10000 = 2570
    expect(r.personalAllowanceUsed).toBe(2570);
    expect(r.taxableIncome).toBe(120000 - 2570);
  });

  it('removes the personal allowance entirely at £125,140', () => {
    const r = computeUkTax({ grossIncome: PA_TAPER_END, pensionContributionsRelief: 0 });
    expect(r.personalAllowanceUsed).toBe(0);
  });

  it('applies the additional rate above £125,140', () => {
    const r = computeUkTax({ grossIncome: 200000, pensionContributionsRelief: 0 });
    const taxable = 200000;
    expect(r.taxableIncome).toBe(200000);
    const expected = BASIC_BAND_TOP * 0.2 + (HIGHER_BAND_TOP - BASIC_BAND_TOP) * 0.4 + (taxable - HIGHER_BAND_TOP) * 0.45;
    expect(r.incomeTax).toBeCloseTo(expected, 6);
    expect(r.marginalRate).toBe(0.45);
  });

  it('subtracts pension relief before computing tax', () => {
    const r = computeUkTax({ grossIncome: 60000, pensionContributionsRelief: 10000 });
    expect(r.taxableIncome).toBe(60000 - 10000 - PERSONAL_ALLOWANCE);
  });

  it('computes effective rate, total tax, and take-home', () => {
    const r = computeUkTax({ grossIncome: 45000, pensionContributionsRelief: 0 });
    const total = r.incomeTax + r.nationalInsurance.total;
    expect(r.totalTax).toBeCloseTo(total, 6);
    expect(r.effectiveRate).toBeCloseTo(total / 45000, 6);
    expect(r.takeHome).toBeCloseTo(45000 - total, 6);
  });
});
