import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';

const SITE_URL = process.env.SITE_URL || 'https://offline-web-tools.net';

// wasm-pandoc ships its WASM + core as deep files but only exposes "." in its
// package "exports" map, which blocks direct subpath imports. Alias core.js to
// the real file so Vite can bundle it (core.js is the small, env-agnostic
// loader). The 56 MB pandoc.wasm engine is never bundled: it is always fetched
// at runtime from PANDOC_WASM_URL (defined in the worker) so the static build
// stays small and fits within hosting file-size caps (e.g. Cloudflare Pages'
// 25 MB limit).
const pandocDir = fileURLToPath(new URL('./node_modules/wasm-pandoc/src/', import.meta.url));

export default defineConfig({
  site: SITE_URL,
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    resolve: {
      alias: [
        { find: 'wasm-pandoc/src/core.js', replacement: pandocDir + 'core.js' },
      ],
    },
  },
});
