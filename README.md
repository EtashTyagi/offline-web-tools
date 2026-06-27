# OfflineWebTools

A collection of 100% client-side web tools. Every tool runs in your browser. No
data ever leaves your device. Tools range from financial calculators to a Python
interpreter, pcap analysis, client-side LLM/image generation, file conversion,
image manipulation, and more.

Live site: **<https://offline-web-tools.net>**

## Why

- **Private.** Nothing is uploaded. All processing happens locally in your browser.
- **Optionally open source.** A single env var, `IS_OPEN_SOURCE` (default
  `false`), controls whether GitHub links, "open source" copy, and ad slots
  ship. When unset, the build is a private, closed deployment with none of that.
  Set it to `true` for the public open-source build.
- **Fast.** Zero JavaScript ships by default. Tool code loads only when you open a
  tool.
- **Ad-optional.** Ads only render when `IS_OPEN_SOURCE=true` and an AdSense
  client id is provided. The default build ships no ad code at all.

## Tech stack

Astro (static generation + islands) · React (interactive tool islands) ·
TypeScript · Tailwind CSS · Fuse.js (client-side search) · Web Workers + WASM for
heavy compute · Vitest (unit) · Playwright (e2e).

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:4321>.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run validate-tool -- <id>` | Validate a single tool registration |
| `npm run fetch-usage` | Optional: bake GA4 usage data into `src/data/usage.json` |
| `npm run lighthouse` | Run Lighthouse CI on key pages (SEO + perf) |
| `npm run typecheck` | `astro check && tsc --noEmit` type check |
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:unit:watch` | Vitest in watch mode |
| `npm run test:e2e` | Run Playwright browser tests (auto-starts dev server) |
| `npm test` | Run unit tests then e2e tests |

## Environment variables

All environment variables are optional. The site runs fully private and ad-free
without any of them. They are documented in [`.env.example`](./.env.example).

| Variable | Purpose | Default |
|---|---|---|
| `IS_OPEN_SOURCE` | Master toggle. `true` enables GitHub links, "open source" copy, and ad slots. Anything else (or unset) keeps all of that off. | `false` (unset) |
| `ADSENSE_CLIENT_ID` | AdSense client id. Only used when `IS_OPEN_SOURCE=true`. When set, ads render on the site. When empty/unset, no ad code is shipped. | empty |
| `SITE_URL` | Canonical/base URL for SEO, sitemap, and Open Graph tags. | `https://offline-web-tools.net` |
| `GITHUB_REPO_URL` | Base URL of the GitHub repo. Only used when `IS_OPEN_SOURCE=true`. Used by the "get without ads" buttons and source links. | `https://github.com/EtashTyagi/offline-web-tools` |
| `GA_MEASUREMENT_ID` | Google Analytics 4 measurement id for anonymous, opt-in usage telemetry. Independent of `IS_OPEN_SOURCE`. Empty/unset means no telemetry at all. | empty |
| `GA4_PROPERTY_ID` | GA4 property id, only used by the optional build-time `npm run fetch-usage` script that bakes the leaderboard into the static build. Not used at runtime. | empty |
| `GA4_CREDENTIALS_PATH` | Path to a GA4 service-account JSON key authorized for the Data API. Only used by `npm run fetch-usage`. | empty |

### Telemetry model

Telemetry is governed solely by `GA_MEASUREMENT_ID`, independent of
`IS_OPEN_SOURCE` and ads:

- When `GA_MEASUREMENT_ID` is unset/empty: no GA script, no consent banner, no
  settings menu, zero tracking code ships. The build is fully silent.
- When set: users see a one-time opt-in popup on first visit. Nothing is sent to
  Google until they accept. They can change their choice anytime from the
  settings (gear) icon. All data is anonymous and aggregate (page paths and
  `tool_id`s; no user ids, IPs, or fingerprints).

## Build

### Private / closed (default, no GitHub links or ads)

```bash
SITE_URL=https://offline-web-tools.net \
npm run build
```

`IS_OPEN_SOURCE` unset (default) means no GitHub links, no ads, no open-source
copy. This is the self-hosted, ad-free behavior.

### Public open-source (with GitHub links and optional ads)

```bash
IS_OPEN_SOURCE=true \
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx \
SITE_URL=https://offline-web-tools.net \
GITHUB_REPO_URL=https://github.com/EtashTyagi/offline-web-tools \
GA_MEASUREMENT_ID=G-XXXXXXXXXX \
npm run build
```

Ads only render when **both** `IS_OPEN_SOURCE=true` **and** `ADSENSE_CLIENT_ID`
are set. Telemetry only renders when `GA_MEASUREMENT_ID` is set, and nothing is
sent until a user opts in.

### Baking the "Most used tools" leaderboard (optional)

Cross-user ranking requires aggregate data from GA4. To stay 100% client-side at
runtime, ranking data is baked into the static build:

1. Register `tool_id` as a custom event-scoped dimension in GA4 Admin.
2. Run `npm run fetch-usage` (needs `GA4_PROPERTY_ID` + `GA4_CREDENTIALS_PATH`).
   It queries the GA4 Data API and writes `src/data/usage.json`.
3. Then run `npm run build`. The leaderboard renders only when usage data exists.

If you never run the fetch script, the leaderboard section simply does not
render. The site still builds and works.

## Deployment

This site is a static build. The `dist/` folder can be deployed to any static
host. The live deployment uses **Cloudflare Pages**.

### Cloudflare Pages

Cloudflare Pages serves the static `dist/` output. No server-side code is
required. Connect this GitHub repo to Cloudflare Pages and configure:

| Setting | Value |
|---|---|
| **Framework preset** | Astro |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` |
| **Node version** | 18 or 20 (set via `NODE_VERSION` env var) |

#### Environment variables in Cloudflare Pages

Set these under **Pages project → Settings → Environment variables** (use the
Production environment; create a Preview environment with different values if
needed). Only the variables you want for that deployment need to be set. All are
optional.

| Variable | Production value | Notes |
|---|---|---|
| `SITE_URL` | `https://offline-web-tools.net` | Canonical URL for SEO, sitemap, and Open Graph. |
| `IS_OPEN_SOURCE` | `true` | Enable GitHub links, open-source copy, and ad slots. |
| `ADSENSE_CLIENT_ID` | `ca-pub-xxxxxxxxxxxxxxxx` | Only used when `IS_OPEN_SOURCE=true`. Leave empty to ship no ad code. |
| `GITHUB_REPO_URL` | `https://github.com/EtashTyagi/offline-web-tools` | Source-folder links + "get without ads" buttons. |
| `GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Optional anonymous opt-in telemetry. Leave empty for a fully silent build. |
| `NODE_VERSION` | `20` | Pin the Node version Cloudflare uses for the build. |

> The Document Converter's 56 MB pandoc WASM engine is never bundled into the
> build. It is fetched at runtime from a public CORS-enabled CDN
> (`https://unpkg.com/wasm-pandoc@1.0.1/src/pandoc.wasm`), so the build output
> always fits within Cloudflare Pages' 25 MB per-file limit. To change the
> engine URL, edit `PANDOC_WASM_URL` in
> `src/tools/files/document-converter/pandoc.worker.ts`.

> `GA4_PROPERTY_ID` and `GA4_CREDENTIALS_PATH` are **not** needed in Cloudflare.
> They are only used locally by `npm run fetch-usage` to bake the leaderboard
> into the build before deploying.

#### Custom domain

Add `offline-web-tools.net` as a custom domain in the Pages project, then point
its DNS at Cloudflare (CNAME or nameservers). Cloudflare issues the TLS
certificate automatically. Make sure `SITE_URL` matches the final domain so
canonical URLs, the sitemap, and Open Graph tags are correct.

#### Deploy workflow

1. Push to the `master` branch (the GitHub Action runs tests on every push).
2. Cloudflare Pages auto-builds on push and deploys `dist/`.
3. The production deployment lives at `https://offline-web-tools.net`.

> Note: Cloudflare Pages itself requires no configuration in this repo beyond
> the build command and output directory above. Everything else is driven by the
> environment variables.

### Other static hosts

Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, etc.) by
running `npm run build` with the desired environment variables.

## Testing

```bash
npm run test:unit    # Vitest unit tests (tool logic, registry, search)
npm run test:e2e     # Playwright browser tests (auto-starts dev server)
npm test             # unit then e2e
```

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs typecheck, unit
tests, and e2e tests on every push and pull request.

## Adding a tool

See **[AGENTS.md](./AGENTS.md)** for the complete workflow. The short version:

1. Pick or create a category in `src/data/categories.ts`.
2. Create `src/tools/<category>/<tool-id>/` with an `index.ts` and a React
   component.
3. Add the tool to the category's `_registry.ts`.
4. Run `npm run validate-tool -- <tool-id>` then `npm run build`.
5. Write unit + e2e tests (see AGENTS.md §15).

## License

MIT
