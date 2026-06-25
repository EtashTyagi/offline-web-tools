import { describe, it, expect } from 'vitest';
import Fuse from 'fuse.js';
import { buildSearchIndex, categoryName, categoryIcon, featuredList, defaultFuseOptions } from '../../src/lib/search';

describe('search index', () => {
  const index = buildSearchIndex();

  it('has one entry per tool', () => {
    expect(index.length).toBeGreaterThan(0);
  });

  it('every entry has the required fields and a clean path', () => {
    for (const e of index) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.name).toBe('string');
      expect(typeof e.shortDescription).toBe('string');
      expect(Array.isArray(e.keywords)).toBe(true);
      expect(Array.isArray(e.tags)).toBe(true);
      expect(e.path).toMatch(/^\/tools\/[a-z-]+\/[a-z0-9-]+$/);
    }
  });

  it('exposes the serialization converter entry', () => {
    const entry = index.find((e) => e.id === 'serialization-converter');
    expect(entry).toBeDefined();
    expect(entry?.tags).toContain('protobuf to json');
  });
});

describe('fuzzy search behavior', () => {
  const index = buildSearchIndex();
  const fuse = new Fuse(index, defaultFuseOptions());

  it('finds a tool by name', () => {
    const res = fuse.search('mortgage');
    expect(res.some((r) => r.item.id === 'mortgage-calculator')).toBe(true);
  });

  it('finds a tool by a tag synonym not in its name', () => {
    const res = fuse.search('home loan');
    expect(res.some((r) => r.item.id === 'mortgage-calculator')).toBe(true);
  });

  it('finds the serialization converter via tag "protobuf to json"', () => {
    const res = fuse.search('protobuf');
    expect(res.some((r) => r.item.id === 'serialization-converter')).toBe(true);
  });

  it('finds via keyword', () => {
    const res = fuse.search('msgpack');
    expect(res.some((r) => r.item.id === 'serialization-converter')).toBe(true);
  });
});

describe('category helpers', () => {
  it('categoryName resolves known slugs', () => {
    expect(categoryName('dev')).toBe('Developer');
    expect(categoryName('financial')).toBe('Financial');
  });

  it('categoryName falls back to the slug for unknown', () => {
    expect(categoryName('nope')).toBe('nope');
  });

  it('categoryIcon resolves known and falls back', () => {
    expect(typeof categoryIcon('dev')).toBe('string');
    expect(categoryIcon('nope')).toBe('🔧');
  });

  it('featuredList returns only featured tools', () => {
    for (const t of featuredList()) expect(t.featured).toBe(true);
  });
});
