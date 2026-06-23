import { allTools } from './registry';
import { categories } from '../data/categories';
import type { ToolSearchEntry } from '../types/tool';
import type { Tool } from '../types/tool';

export function buildSearchIndex(): ToolSearchEntry[] {
  return allTools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    shortDescription: tool.shortDescription,
    keywords: tool.keywords,
    category: tool.category,
    subcategory: tool.subcategory,
    icon: tool.icon,
    path: `/tools/${tool.category}/${tool.id}`,
  }));
}

export function categoryName(slug: string): string {
  return categories.find((c) => c.slug === slug)?.name ?? slug;
}

export function categoryIcon(slug: string): string {
  return categories.find((c) => c.slug === slug)?.icon ?? '🔧';
}

export type FuseSearchResult = {
  item: ToolSearchEntry;
  score?: number;
};

export function defaultFuseOptions() {
  return {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'keywords', weight: 0.3 },
      { name: 'shortDescription', weight: 0.2 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  };
}

export function featuredList(): Tool[] {
  return allTools.filter((t) => t.featured);
}
