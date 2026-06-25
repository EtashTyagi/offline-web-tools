import { lazy, Suspense, useEffect, useMemo, type ComponentType } from 'react';
import type { Tool } from '../types/tool';
import { trackToolOpen } from '../lib/track';

const registries = import.meta.glob('../tools/**/_registry.ts', { eager: true });

const componentMap: Record<string, () => Promise<{ default: ComponentType<any> }>> = {};

for (const mod of Object.values(registries)) {
  const tools = (mod as { tools?: Tool[] }).tools;
  if (!tools) continue;
  for (const tool of tools) {
    componentMap[tool.id] = tool.component as () => Promise<{
      default: ComponentType<any>;
    }>;
  }
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-[16rem] items-center justify-center text-slate-400 dark:text-slate-500">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500 dark:border-slate-700 dark:border-t-brand-400" />
        <p className="text-sm">Loading tool...</p>
      </div>
    </div>
  );
}

interface Props {
  toolId: string;
  category?: string;
}

export default function ToolIsland({ toolId, category }: Props) {
  const LazyComponent = useMemo(() => {
    const importer = componentMap[toolId];
    if (!importer) return null;
    return lazy(importer);
  }, [toolId]);

  useEffect(() => {
    trackToolOpen(toolId, category);
  }, [toolId, category]);

  if (!LazyComponent) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center text-slate-400 dark:text-slate-500">
        <p>Tool "{toolId}" could not be loaded.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <LazyComponent />
    </Suspense>
  );
}
