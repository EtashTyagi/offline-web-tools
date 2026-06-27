import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';

const SITE_URL = process.env.SITE_URL || 'https://offline-web-tools.net';

// wasm-pandoc ships its WASM + core as deep files but only exposes "." in its
// package "exports" map, which blocks direct subpath imports. Alias those
// subpaths to the real files so Vite can bundle them. core.js is the small,
// env-agnostic loader. The 56 MB pandoc.wasm is resolved through a virtual
// module (see pandocWasmUrlPlugin below) so it can optionally be fetched from
// an external URL instead of bundled.
const pandocDir = fileURLToPath(new URL('./node_modules/wasm-pandoc/src/', import.meta.url));

const PANDOC_WASM_VIRTUAL = 'virtual:pandoc-wasm-url';

// When PANDOC_WASM_URL is set, the 56 MB pandoc engine is fetched from that URL
// at runtime instead of being emitted into the build. This is required on
// hosts with a per-file size cap (e.g. Cloudflare Pages' 25 MB limit). When
// unset, the WASM is bundled as a local asset for fully offline self-hosting.
function pandocWasmUrlPlugin() {
  return {
    name: 'pandoc-wasm-url',
    resolveId(source) {
      if (source === PANDOC_WASM_VIRTUAL) return '\0' + PANDOC_WASM_VIRTUAL;
    },
    load(id) {
      if (id !== '\0' + PANDOC_WASM_VIRTUAL) return null;
      const external = process.env.PANDOC_WASM_URL;
      if (external) {
        return `export default ${JSON.stringify(external)};`;
      }
      return `import url from 'wasm-pandoc/src/pandoc.wasm?url'; export default url;`;
    },
  };
}

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
    plugins: [pandocWasmUrlPlugin()],
    resolve: {
      alias: [
        { find: 'wasm-pandoc/src/core.js', replacement: pandocDir + 'core.js' },
        { find: /^wasm-pandoc\/src\/pandoc\.wasm/, replacement: pandocDir + 'pandoc.wasm' },
      ],
    },
  },
});
