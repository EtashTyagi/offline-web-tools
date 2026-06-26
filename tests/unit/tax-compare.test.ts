import { describe, it, expect } from 'vitest';
import {
  BASE_CURRENCIES,
  FX_TO_USD,
  compareAll,
  convert,
  fxRate,
  sortByEffectiveRate,
  sortByTakeHome,
} from '../../src/lib/taxCompare';
import { TAX_COUNTRIES } from '../../src/lib/taxCountries';

const COUNTRY_IDS = TAX_COUNTRIES.map((c) => c.id);

describe('fx rates', () => {
  it('identity rate is 1', () => {
    expect(fxRate('USD', 'USD')).toBe(1);
    expect(fxRate('EUR', 'EUR')).toBe(1);
  });

  it('converts USD to EUR using the baked rate', () => {
    // 1 EUR = 1.08 USD, so 100 USD = 100/1.08 EUR
    expect(convert(100, 'USD', 'EUR')).toBeCloseTo(100 / FX_TO_USD.EUR, 6);
  });

  it('round-trips through a third currency', () => {
    const start = 50000;
    const toEur = convert(start, 'USD', 'EUR');
    const back = convert(toEur, 'EUR', 'USD');
    expect(back).toBeCloseTo(start, 4);
  });

  it('falls back to 1:1 for unknown currencies', () => {
    expect(fxRate('USD', 'ZZZ')).toBe(1);
    expect(convert(123, 'USD', 'ZZZ')).toBe(123);
  });
});

describe('compareAll shape', () => {
  const result = compareAll('USD', 60000);

  it('returns one entry per supported country', () => {
    expect(result.countries).toHaveLength(TAX_COUNTRIES.length);
    expect(result.countries.map((c) => c.id).sort()).toEqual([...COUNTRY_IDS].sort());
  });

  it('carries code, currency, flag, and tax year metadata', () => {
    for (const c of result.countries) {
      const meta = TAX_COUNTRIES.find((m) => m.id === c.id);
      expect(meta).toBeDefined();
      expect(c.code).toBe(meta!.code);
      expect(c.currency).toBe(meta!.currency);
      expect(c.flag).toBe(meta!.flag);
      expect(c.taxYear).toBe(meta!.taxYear);
    }
  });

  it('keeps each country result internally consistent', () => {
    for (const c of result.countries) {
      expect(c.totalTaxLocal).toBeGreaterThanOrEqual(0);
      expect(c.takeHomeLocal).toBeGreaterThanOrEqual(0);
      expect(c.takeHomeLocal).toBeCloseTo(c.grossLocal - c.totalTaxLocal, 6);
      expect(c.effectiveRate).toBeGreaterThanOrEqual(0);
      expect(c.effectiveRate).toBeLessThanOrEqual(1);
      expect(c.marginalRate).toBeGreaterThanOrEqual(0);
      expect(c.marginalRate).toBeLessThanOrEqual(1);
    }
  });

  it('converts total tax and take-home back to the base currency exactly', () => {
    for (const c of result.countries) {
      expect(c.totalTaxBase + c.takeHomeBase).toBeCloseTo(result.grossBase, 6);
    }
  });
});

describe('compareAll currency independence', () => {
  it('yields the same effective rate regardless of the base currency', () => {
    const usd = compareAll('USD', 60000);
    const eurGross = convert(60000, 'USD', 'EUR');
    const eur = compareAll('EUR', eurGross);

    for (const id of COUNTRY_IDS) {
      const a = usd.countries.find((c) => c.id === id)!;
      const b = eur.countries.find((c) => c.id === id)!;
      expect(a.grossLocal).toBeCloseTo(b.grossLocal, 6);
      expect(a.totalTaxLocal).toBeCloseTo(b.totalTaxLocal, 6);
      expect(a.effectiveRate).toBeCloseTo(b.effectiveRate, 10);
      expect(a.marginalRate).toBeCloseTo(b.marginalRate, 10);
    }
  });
});

describe('compareAll monotonicity', () => {
  it('taxes more at a higher income for every country', () => {
    const low = compareAll('USD', 60000);
    const high = compareAll('USD', 200000);
    for (const id of COUNTRY_IDS) {
      const l = low.countries.find((c) => c.id === id)!;
      const h = high.countries.find((c) => c.id === id)!;
      expect(h.totalTaxBase).toBeGreaterThanOrEqual(l.totalTaxBase);
      expect(h.effectiveRate).toBeGreaterThanOrEqual(l.effectiveRate - 1e-9);
    }
  });
});

describe('compareAll edge cases', () => {
  it('returns zero tax for zero income', () => {
    const r = compareAll('USD', 0);
    expect(r.grossBase).toBe(0);
    for (const c of r.countries) {
      expect(c.grossLocal).toBe(0);
      expect(c.totalTaxLocal).toBe(0);
      expect(c.takeHomeLocal).toBe(0);
      expect(c.effectiveRate).toBe(0);
    }
  });

  it('treats negative income as zero', () => {
    const r = compareAll('USD', -500);
    expect(r.grossBase).toBe(0);
    for (const c of r.countries) expect(c.totalTaxLocal).toBe(0);
  });
});

describe('compareAll ranking', () => {
  it('identifies the cheapest and most expensive countries', () => {
    const r = compareAll('USD', 200000);
    expect(COUNTRY_IDS).toContain(r.lowestTaxId);
    expect(COUNTRY_IDS).toContain(r.highestTaxId);
    const lowest = r.countries.find((c) => c.id === r.lowestTaxId)!;
    const highest = r.countries.find((c) => c.id === r.highestTaxId)!;
    expect(lowest.totalTaxBase).toBeLessThan(highest.totalTaxBase);
  });

  it('sortByEffectiveRate returns ascending rates', () => {
    const r = compareAll('USD', 200000);
    const sorted = sortByEffectiveRate(r);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].effectiveRate).toBeGreaterThanOrEqual(sorted[i - 1].effectiveRate);
    }
  });

  it('sortByTakeHome returns descending take-home', () => {
    const r = compareAll('USD', 200000);
    const sorted = sortByTakeHome(r);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].takeHomeBase).toBeLessThanOrEqual(sorted[i - 1].takeHomeBase);
    }
  });
});

describe('BASE_CURRENCIES', () => {
  it('includes the user-facing currencies with FX rates', () => {
    for (const cur of BASE_CURRENCIES) {
      expect(FX_TO_USD).toHaveProperty(cur);
    }
    expect(BASE_CURRENCIES).toContain('USD');
    expect(BASE_CURRENCIES).toContain('EUR');
  });
});
