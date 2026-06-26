import { describe, it, expect } from 'vitest';
import {
  algemeneHeffingskorting,
  arbeidskorting,
  computeNlTax,
  ALGEMENE_MAX,
  ALGEMENE_PHASE_OUT_FROM,
  ALGEMENE_PHASE_OUT_TO,
} from '../../src/tools/financial/netherlands-income-tax-calculator/netherlandsTax';

describe('algemeneHeffingskorting', () => {
  it('gives the full amount up to the phase-out start', () => {
    expect(algemeneHeffingskorting(20000)).toBeCloseTo(ALGEMENE_MAX, 6);
    expect(algemeneHeffingskorting(ALGEMENE_PHASE_OUT_FROM)).toBeCloseTo(ALGEMENE_MAX, 6);
  });

  it('phases out to zero at the upper limit', () => {
    expect(algemeneHeffingskorting(ALGEMENE_PHASE_OUT_TO)).toBeCloseTo(0, 4);
    expect(algemeneHeffingskorting(100000)).toBe(0);
  });

  it('reduces linearly in the phase-out range', () => {
    const mid = (ALGEMENE_PHASE_OUT_FROM + ALGEMENE_PHASE_OUT_TO) / 2;
    const val = algemeneHeffingskorting(mid);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(ALGEMENE_MAX);
  });
});

describe('arbeidskorting', () => {
  it('builds up at 8.053% for low income', () => {
    expect(arbeidskorting(10000)).toBeCloseTo(10000 * 0.08053, 4);
  });

  it('reaches about €5,599 around €43,071', () => {
    expect(arbeidskorting(43071)).toBeCloseTo(5599, 0);
  });

  it('returns zero above €129,078', () => {
    expect(arbeidskorting(130000)).toBe(0);
  });

  it('returns zero for zero income', () => {
    expect(arbeidskorting(0)).toBe(0);
  });
});

describe('computeNlTax — Box 1', () => {
  it('taxes €50,000 across the first two brackets', () => {
    const r = computeNlTax({ income: 50000 });
    const expected = 38441 * 0.3582 + (50000 - 38441) * 0.3748;
    expect(r.box1TaxBeforeCredits).toBeCloseTo(expected, 4);
    expect(r.marginalRate).toBe(0.3748);
  });

  it('applies the 49.5% top bracket above €76,817', () => {
    const r = computeNlTax({ income: 100000 });
    const expected = 38441 * 0.3582 + (76817 - 38441) * 0.3748 + (100000 - 76817) * 0.495;
    expect(r.box1TaxBeforeCredits).toBeCloseTo(expected, 4);
    expect(r.marginalRate).toBe(0.495);
  });

  it('subtracts heffingskortingen from the gross tax', () => {
    const r = computeNlTax({ income: 40000 });
    expect(r.totalTax).toBeCloseTo(
      Math.max(0, r.box1TaxBeforeCredits - r.algemeneHeffingskorting - r.arbeidskorting),
      6,
    );
  });

  it('matches the published total-credit table for €40,000 (~€7,863)', () => {
    // Belastinghelden: €40,000 -> algemene €2,333 + arbeid €5,530 -> total €7,863 credit
    expect(r40kTotalCredit()).toBeCloseTo(7863, 0);
  });

  it('slices sum to gross box 1 tax', () => {
    const r = computeNlTax({ income: 120000 });
    const sum = r.slices.reduce((s, b) => s + b.tax, 0);
    expect(sum).toBeCloseTo(r.box1TaxBeforeCredits, 6);
  });

  it('computes effective rate and zero-tax at zero income', () => {
    const r = computeNlTax({ income: 60000 });
    expect(r.effectiveRate).toBeCloseTo(r.totalTax / 60000, 6);
    expect(computeNlTax({ income: 0 }).totalTax).toBe(0);
  });
});

function r40kTotalCredit(): number {
  const r = computeNlTax({ income: 40000 });
  return r.algemeneHeffingskorting + r.arbeidskorting;
}
