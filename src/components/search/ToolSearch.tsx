import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { ToolSearchEntry } from '../../types/tool';
import { defaultFuseOptions, categoryName, categoryIcon } from '../../lib/search';

interface Props {
  index: ToolSearchEntry[];
}

interface GroupedResults {
  category: string;
  tools: ToolSearchEntry[];
}

export default function ToolSearch({ index }: Props) {
  const [query, setQuery] = useState('');

  const fuse = useMemo(() => {
    return new Fuse(index, defaultFuseOptions());
  }, [index]);

  const results = useMemo<GroupedResults[]>(() => {
    const list = query.trim()
      ? fuse.search(query).map((r) => r.item)
      : index;

    const grouped = new Map<string, ToolSearchEntry[]>();
    for (const tool of list) {
      const arr = grouped.get(tool.category) ?? [];
      arr.push(tool);
      grouped.set(tool.category, arr);
    }
    return Array.from(grouped.entries()).map(([category, tools]) => ({
      category,
      tools,
    }));
  }, [query, fuse, index]);

  const total = results.reduce((n, g) => n + g.tools.length, 0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setQuery(q);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <label htmlFor="tool-search" className="sr-only">
          Search tools
        </label>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
          🔍
        </span>
        <input
          id="tool-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools by name or description..."
          autoComplete="off"
          className="input pl-10 text-base"
        />
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        {query.trim()
          ? `${total} tool${total === 1 ? '' : 's'} matching "${query}"`
          : `Showing all ${index.length} tools`}
      </p>

      {total === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          No tools found. Try a different search term.
        </div>
      ) : (
        results.map((group) => (
          <section key={group.category} id={group.category} className="scroll-mt-20">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-white">
              <span aria-hidden="true">{categoryIcon(group.category)}</span>
              {categoryName(group.category)}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <a
                  key={tool.id}
                  href={tool.path}
                  className="card group flex flex-col gap-2 hover:ring-brand-500 dark:hover:ring-brand-400"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl" aria-hidden="true">
                      {tool.icon}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{tool.shortDescription}</p>
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
