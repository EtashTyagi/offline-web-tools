import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';

const SITE_URL = process.env.SITE_URL || 'https://offline-web-tools.net';

// wasm-pandoc ships its WASM + core as deep files but only exposes "." in its
// package "exports" map, which blocks direct subpath imports. Alias those
// subpaths to the real files so Vite can bundle them (the 56 MB pandoc.wasm is
// emitted as a lazily-fetched asset; core.js is the small, env-agnostic loader).
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
        { find: /^wasm-pandoc\/src\/pandoc\.wasm/, replacement: pandocDir + 'pandoc.wasm' },
      ],
    },
  },
});
