# OfflineWebTools

A collection of 100% client-side web tools. Every tool runs in your browser. No
data ever leaves your device. Tools range from financial calculators to a Python
interpreter, pcap analysis, client-side LLM/image generation, file conversion,
image manipulation, and more.

## Why

- **Private.** Nothing is uploaded. All processing happens locally in your browser.
- **Optionally open source.** A single env var, `IS_OPEN_SOURCE` (default `false`),
  controls whether GitHub links, "open source" copy, and ad slots ship. When unset,
  the build is a private, closed deployment with none of that. Set it to `true`
  for the public open-source build.
- **Fast.** Zero JavaScript ships by default. Tool code loads only when you open a
  tool.
- **Ad-optional.** Ads only render when `IS_OPEN_SOURCE=true` and an AdSense client
  id is provided. The default build ships no ad code at all.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:4321.

## Build

Private / closed (default, no GitHub links or ads):

```bash
npm run build
```

Public open-source (with GitHub links and optional ads):

```bash
IS_OPEN_SOURCE=true \
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx \
SITE_URL=https://offline-web-tools.com \
GITHUB_REPO_URL=https://github.com/your-org/OfflineWebTools \
npm run build
```

Ads only render when both `IS_OPEN_SOURCE=true` and `ADSENSE_CLIENT_ID` are set.

Deploy the `dist/` folder to any static host (Cloudflare Pages, Netlify, Vercel,
GitHub Pages).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run validate-tool -- <id>` | Validate a single tool registration |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Run e2e tests |

## Adding a tool

See **[AGENTS.md](./AGENTS.md)** for the complete workflow. The short version:

1. Pick or create a category in `src/data/categories.ts`.
2. Create `src/tools/<category>/<tool-id>/` with an `index.ts` and a React
   component.
3. Add the tool to the category's `_registry.ts`.
4. Run `npm run validate-tool -- <tool-id>` then `npm run build`.

## License

MIT
