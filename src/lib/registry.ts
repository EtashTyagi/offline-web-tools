import type { Tool, Category } from '../types/tool';
import { categories } from '../data/categories';

const registries = import.meta.glob('../tools/**/_registry.ts', { eager: true });

function isToolArray(value: unknown): value is Tool[] {
  return Array.isArray(value);
}

const allTools: Tool[] = [];

for (const [path, mod] of Object.entries(registries)) {
  const tools = (mod as { tools?: Tool[] }).tools;
  if (isToolArray(tools)) {
    for (const tool of tools) {
      allTools.push(tool);
    }
  } else {
    throw new Error(
      `Registry ${path} must export a named \`tools\` array of Tool objects.`,
    );
  }
}

const seenIds = new Set<string>();
for (const tool of allTools) {
  if (seenIds.has(tool.id)) {
    throw new Error(`Duplicate tool id "${tool.id}". Tool ids must be unique.`);
  }
  seenIds.add(tool.id);
}

export { allTools };

export const nonEmptyCategories: Category[] = (() => {
  const used = new Set(allTools.map((t) => t.category));
  return categories.filter((c) => used.has(c.slug));
})();

export function getTool(id: string): Tool | undefined {
  return allTools.find((t) => t.id === id);
}

export function toolsByCategory(category: string): Tool[] {
  return allTools.filter((t) => t.category === category);
}

export function featuredTools(): Tool[] {
  return allTools.filter((t) => t.featured);
}
