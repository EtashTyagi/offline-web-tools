import usage from '../data/usage.json';
import { allTools } from './registry';

export interface ToolUsage {
  id: string;
  name: string;
  icon: string;
  category: string;
  path: string;
  uses: number;
  opens: number;
}

export interface UsageData {
  generatedAt: string | null;
  totals: {
    totalUses: number;
    totalOpens: number;
    uniqueTools: number;
  };
  tools: ToolUsage[];
}

const data = usage as unknown as UsageData;

const toolIndex = new Map(allTools.map((t) => [t.id, t]));

export function hasUsageData(): boolean {
  return Array.isArray(data.tools) && data.tools.length > 0;
}

export function usageGeneratedAt(): string | null {
  return data.generatedAt ?? null;
}

export function usageTotals() {
  return data.totals;
}

export function topTools(limit: number): ToolUsage[] {
  const ranked = [...data.tools].sort((a, b) => {
    const scoreA = a.uses * 5 + a.opens;
    const scoreB = b.uses * 5 + b.opens;
    return scoreB - scoreA;
  });
  return ranked.slice(0, limit).map((t) => ({
    ...t,
    name: toolIndex.get(t.id)?.name ?? t.name,
    icon: toolIndex.get(t.id)?.icon ?? t.icon,
    category: toolIndex.get(t.id)?.category ?? t.category,
    path: `/tools/${toolIndex.get(t.id)?.category ?? t.category}/${t.id}`,
  }));
}
