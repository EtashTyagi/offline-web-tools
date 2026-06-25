import { describe, it, expect } from 'vitest';
import { allTools, getTool, toolsByCategory, featuredTools, nonEmptyCategories } from '../../src/lib/registry';
import { categories, validCategorySlug, validSubcategorySlug } from '../../src/data/categories';

describe('tool registry invariants', () => {
  it('aggregates at least the known tools', () => {
    const ids = allTools.map((t) => t.id);
    expect(ids).toContain('mortgage-calculator');
    expect(ids).toContain('serialization-converter');
  });

  it('has unique tool ids', () => {
    const ids = allTools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every tool id is kebab-case', () => {
    const re = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const t of allTools) expect(re.test(t.id), `id "${t.id}"`).toBe(true);
  });

  it('every tool references a valid category', () => {
    for (const t of allTools) expect(validCategorySlug(t.category), `${t.id} category ${t.category}`).toBe(true);
  });

  it('every tool subcategory (if set) exists under its category', () => {
    for (const t of allTools) {
      if (t.subcategory) expect(validSubcategorySlug(t.category, t.subcategory), `${t.id}`).toBe(true);
    }
  });

  it('every tool has a lazy component import', () => {
    for (const t of allTools) expect(typeof t.component).toBe('function');
  });

  it('every tool has required metadata fields', () => {
    for (const t of allTools) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.shortDescription).toBe('string');
      expect(t.shortDescription.length).toBeLessThanOrEqual(100);
      expect(typeof t.description).toBe('string');
      expect(Array.isArray(t.keywords)).toBe(true);
      expect(typeof t.icon).toBe('string');
      expect(['active', 'beta', 'experimental']).toContain(t.status);
      expect(t.seo.title.length).toBeLessThan(60);
      expect(t.seo.description.length).toBeLessThan(160);
    }
  });

  it('every tool has tags with no keyword/name overlap', () => {
    for (const t of allTools) {
      const tags = t.tags ?? [];
      expect(tags.length, `${t.id} should have tags`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag.toLowerCase(), `${t.id} tag "${tag}" equals name`).not.toBe(t.name.toLowerCase());
        expect(t.keywords, `${t.id} tag "${tag}" duplicates a keyword`).not.toContain(tag);
      }
    }
  });

  it('category slugs in categories.ts are unique', () => {
    const slugs = categories.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('nonEmptyCategories only contains categories that have tools', () => {
    const used = new Set(allTools.map((t) => t.category));
    for (const c of nonEmptyCategories) expect(used.has(c.slug)).toBe(true);
  });
});

describe('registry accessors', () => {
  it('getTool finds by id', () => {
    expect(getTool('mortgage-calculator')?.name).toBe('Mortgage Calculator');
    expect(getTool('does-not-exist')).toBeUndefined();
  });

  it('toolsByCategory filters by category', () => {
    const dev = toolsByCategory('dev');
    expect(dev.length).toBeGreaterThan(0);
    for (const t of dev) expect(t.category).toBe('dev');
  });

  it('featuredTools returns only featured tools', () => {
    for (const t of featuredTools()) expect(t.featured).toBe(true);
  });
});
