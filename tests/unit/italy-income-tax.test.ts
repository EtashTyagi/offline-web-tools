import { describe, it, expect } from 'vitest';
import {
  computeItalyTax,
  MUNICIPAL_RATE_DEFAULT,
  REGIONAL_RATE_DEFAULT,
} from '../../src/tools/financial/italy-income-tax-calculator/italyTax';

describe('Italy IRPEF', () => {
  it('applies the 23% bracket up to €28,000', () => {
    const r = computeItalyTax({ taxableIncome: 28000, regionalRate: 0, municipalRate: 0 });
    expect(r.nationalIrpef).toBeCloseTo(28000 * 0.23, 6);
    expect(r.marginalRate).toBe(0.23);
  });

  it('crosses into the 35% bracket', () => {
    const r = computeItalyTax({ taxableIncome: 50000, regionalRate: 0, municipalRate: 0 });
    const expected = 28000 * 0.23 + (50000 - 28000) * 0.35;
    expect(r.nationalIrpef).toBeCloseTo(expected, 6);
    expect(r.marginalRate).toBe(0.35);
  });

  it('applies the 43% top bracket above €50,000', () => {
    const r = computeItalyTax({ taxableIncome: 80000, regionalRate: 0, municipalRate: 0 });
    const expected = 28000 * 0.23 + (50000 - 28000) * 0.35 + (80000 - 50000) * 0.43;
    expect(r.nationalIrpef).toBeCloseTo(expected, 6);
    expect(r.marginalRate).toBe(0.43);
  });

  it('adds regional and municipal surtaxes on the base', () => {
    const r = computeItalyTax({
      taxableIncome: 30000,
      regionalRate: REGIONAL_RATE_DEFAULT,
      municipalRate: MUNICIPAL_RATE_DEFAULT,
    });
    expect(r.regionalTax).toBeCloseTo(30000 * 0.014, 6);
    expect(r.municipalTax).toBeCloseTo(30000 * 0.008, 6);
    expect(r.totalTax).toBeCloseTo(r.nationalIrpef + r.regionalTax + r.municipalTax, 6);
  });

  it('clamps regional rate to the 1.23%-3.33% range', () => {
    const low = computeItalyTax({ taxableIncome: 50000, regionalRate: 0.01, municipalRate: 0 });
    const high = computeItalyTax({ taxableIncome: 50000, regionalRate: 0.10, municipalRate: 0 });
    expect(low.regionalTax).toBeCloseTo(50000 * 0.0123, 6);
    expect(high.regionalTax).toBeCloseTo(50000 * 0.0333, 6);
  });

  it('slices sum to national IRPEF', () => {
    const r = computeItalyTax({ taxableIncome: 60000, regionalRate: 0, municipalRate: 0 });
    const sum = r.slices.reduce((s, b) => s + b.tax, 0);
    expect(sum).toBeCloseTo(r.nationalIrpef, 6);
  });

  it('computes effective rate', () => {
    const r = computeItalyTax({ taxableIncome: 50000, regionalRate: 0.02, municipalRate: 0.005 });
    expect(r.effectiveRate).toBeCloseTo(r.totalTax / 50000, 6);
  });

  it('returns zero tax for zero income', () => {
    const r = computeItalyTax({ taxableIncome: 0, regionalRate: 0.02, municipalRate: 0.005 });
    expect(r.totalTax).toBe(0);
  });
});
