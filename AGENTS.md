# AGENTS.md

This file is the single source of truth for how this project is structured and how
new tools ("apps") are built. Any agent working in this repo MUST read this file
before making changes. A human (or agent) should be able to say **"Create an app
that does X"** and, using only the context in this file, produce a complete,
registered, SEO-optimized, ad-aware tool that shows up in search.

---

## 1. Project Overview

**OfflineWebTools** is a collection of 100% client-side web tools. Every tool runs
in the browser. No data ever leaves the user's device. Tools range from financial
calculators to a Python interpreter, pcap analysis, client-side LLM/image
generation, file conversion, image manipulation, and more.

The project is:

- **Optionally open source.** A single env var, `IS_OPEN_SOURCE` (default
  `false`), controls whether GitHub links, "open source" copy, and ad slots are
  shipped. When `false` (the default), the build is a private, closed deployment:
  no GitHub references, no ad code, no open-source marketing text. When `true`,
  the build is the public open-source deployment: GitHub links and open-source
  copy show, and ads may render.
- **Self-hostable** (clone + build = private, fully ad-free by default).
- **Hosted** at a public URL for easy access, with **non-aggressive ads** that
  are only enabled when `IS_OPEN_SOURCE=true` and an AdSense client id is
  provided. Ads are NOT removed from the open-source hosted build — that is the
  intended trade for free hosting. Users who want ad-free access self-host the
  site or grab a single tool from its GitHub folder via the `<DownloadButton>`.
- **Opt-in telemetry.** A separate, independent env var `GA_MEASUREMENT_ID`
  controls anonymous usage telemetry (see §4.6). It is decoupled from
  `IS_OPEN_SOURCE` and ads: a build may have telemetry, ads, both, or neither.

### Core principles (non-negotiable)

1. **Client-side only.** Tool logic never calls a server. Heavy work (WASM, LLM,
   pcap) runs in Web Workers or in-browser.
2. **Privacy first.** No telemetry, no upload, no tracking beyond what the ad
   network requires on the open-source hosted build.
3. **Fast loads.** Ship zero JS by default. Load tool JS only when the user opens
   a tool (islands + dynamic imports + code splitting).
4. **SEO first.** Every page is statically generated with correct meta tags,
   structured data, and semantic HTML.
5. **Progressive enhancement.** The tool listing and all text content work with JS
   disabled. Interactivity layers on top.

---

## 2. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Meta-framework | **Astro** | Static generation for SEO, zero-JS by default, islands architecture for on-demand tool JS |
| Interactive UI | **React** (islands only) | Familiar, large ecosystem for complex tool UIs |
| Language | **TypeScript** everywhere | Type safety for the registry + tools |
| Styling | **Tailwind CSS** | Utility-first, small bundles, consistent |
| Search | **Fuse.js** | Client-side fuzzy search, no server needed |
| Heavy compute | **Web Workers + WASM** | Keep main thread free |
| Sitemap | `@astrojs/sitemap` | Auto sitemap.xml for SEO |
| Hosting | Any static host (Cloudflare Pages, Netlify, Vercel, GitHub Pages) | It's a static build |

---

## 3. Directory Structure

```
OfflineWebTools/
├── AGENTS.md                      # THIS FILE
├── README.md
├── LICENSE
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── tailwind.config.mjs
├── .env.example                   # documents all env vars
├── .gitignore
├── public/
│   ├── robots.txt
│   ├── favicon.svg
│   ├── og-default.png             # default Open Graph image
│   └── site.webmanifest
├── scripts/
│   ├── validate-tool.mjs         # validates a tool registration (run before commit)
│   └── fetch-usage.mjs           # OPTIONAL: pulls GA4 usage counts, writes usage.json
├── src/
│   ├── env.d.ts                   # env var types
│   ├── types/
│   │   └── tool.ts                # Tool, Category, ToolSeo interfaces
│   ├── data/
│   │   ├── categories.ts          # category + subcategory definitions
│   │   └── usage.json             # baked usage data (empty until fetch-usage runs)
│   ├── lib/
│   │   ├── registry.ts            # auto-aggregates all tools via import.meta.glob
│   │   ├── ads.ts                 # env-driven ad control
│   │   ├── seo.ts                 # meta tag + JSON-LD helpers
│   │   ├── search.ts              # builds the search index from the registry
│   │   ├── telemetry.ts           # GA_MEASUREMENT_ID build-time gate
│   │   ├── track.ts               # typed client-side telemetry wrappers
│   │   └── usage.ts               # reads usage.json for the leaderboard
│   ├── layouts/
│   │   ├── BaseLayout.astro       # <html>, head, header/footer, ad slots, GA4 + consent
│   │   └── ToolLayout.astro       # tool page shell: title, desc, ad, download btn
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   ├── AdSlot.astro       # renders ad ONLY if ads enabled
│   │   │   ├── DownloadButton.astro
│   │   │   ├── ConsentBanner.astro # first-visit opt-in (only if GA_MEASUREMENT_ID set)
│   │   │   ├── SettingsMenu.astro  # gear icon to toggle telemetry (only if GA id set)
│   │   │   └── ThemeToggle.astro
│   │   ├── search/
│   │   │   └── ToolSearch.tsx     # React island: fuzzy search over all tools
│   │   ├── ToolIsland.tsx         # lazy tool loader; auto-fires tool_open event
│   │   └── ui/
│   │       ├── ToolCard.astro     # card for a tool in listings
│   │       └── CategoryNav.astro  # category sidebar/nav
│   ├── pages/
│   │   ├── index.astro            # LANDING PAGE: hero, animations, random-tool showcase
│   │   ├── search-tools.astro     # SEARCH PAGE: searchable list of all tools
│   │   ├── 404.astro
│   │   └── tools/
│   │       └── [category]/
│   │           └── [tool].astro   # dynamically SSG'd tool page per tool
│   ├── styles/
│   │   └── global.css
│   └── tools/                     # === ALL TOOL IMPLEMENTATIONS LIVE HERE ===
│       ├── financial/
│       │   ├── _registry.ts       # exports the list of tools in this category
│       │   └── mortgage-calculator/
│       │       ├── index.ts       # tool definition (metadata + lazy component)
│       │       └── Calculator.tsx # React island (the actual tool UI)
│       ├── dev/
│       │   ├── _registry.ts
│       │   └── python-interpreter/
│       │       ├── index.ts
│       │       └── Interpreter.tsx
│       └── ...                    # more categories
└── tests/
    └── e2e/                       # Playwright tests
```

---

## 4. Architecture

### 4.1 Dynamic loading & quick load times

- **Astro islands.** The landing page, search page, and tool pages render as static HTML. React only
  hydrates the specific interactive island a user needs.
- **`client:visible`** is the default hydration directive for tool components: the
  tool's JS (and its heavy deps) only download when the tool scrolls into view or
  the user navigates to it.
- **Lazy component imports.** Each tool's `index.ts` exports a `component` field
  that is a dynamic `() => import('./Tool.tsx')`. This guarantees code splitting,
  one chunk per tool.
- **Heavy tools (`heavy: true`).** Tools that pull in large dependencies (WASM
  runtimes, LLM weights, large libs) must:
  - Use `client:visible` (never `client:load`).
  - Show a lightweight placeholder/skeleton while the chunk + worker boot.
  - Move CPU-bound work into a **Web Worker** so the main thread stays responsive.
  - Lazy-load secondary assets (e.g. model files) only when the user starts the
    action, with a progress indicator.
- **Prefetch.** Astro's prefetch is enabled for tool links so navigation feels
  instant, but prefetch never blocks the initial render.

### 4.2 SEO strategy

Every page is statically generated at build time.

- **Per-page meta.** Title (< 60 chars), meta description (< 160 chars), canonical
  URL, Open Graph, Twitter card. Generated from each tool's `seo` field via
  `src/lib/seo.ts`.
- **Structured data.** Each tool page emits `SoftwareApplication` JSON-LD. The
  homepage emits `WebSite` + `SearchAction` JSON-LD (so Google can show a site
  search box).
- **Semantic HTML.** One `<h1>` per page, logical heading order, `<nav>`, `<main>`,
  `<article>`, descriptive `<a>` text, `alt` on images.
- **Sitemap.** `@astrojs/sitemap` auto-generates `sitemap-index.xml`. Submit it in
  Google Search Console.
- **robots.txt** allows all, points to the sitemap.
- **Clean URLs.** `/tools/financial/mortgage-calculator` (kebab-case, no query
  strings, no `.html`).
- **Mobile-first.** Tailwind responsive, tested on small screens. Google uses
  mobile-first indexing.
- **Core Web Vitals.** Zero-JS by default + islands + lazy heavy deps keeps LCP,
  INP, and CLS green. Run `npm run lighthouse` before shipping.

### 4.3 Ad system & open-source mode

Ads and GitHub references are **opt-in via the master env var `IS_OPEN_SOURCE`**
(default `false`) and are **non-aggressive**.

- **Master toggle:** `IS_OPEN_SOURCE` (`true` / `false`, default `false`).
  - **`false` (default)** → private / closed deployment. No GitHub links, no
    "open source" copy, no ad code at all. This is the default and the
    self-hosted behavior.
  - **`true`** → public open-source deployment. GitHub links and open-source copy
    show, and ads are allowed to render.
- **Ad client id:** `ADSENSE_CLIENT_ID` (e.g. `ca-pub-1234567890123456`). Ads only
  render when **both** `IS_OPEN_SOURCE=true` **and** `ADSENSE_CLIENT_ID` is set.
  - If either is unset → **no ads**, no ad script loaded at all.
  - If both set → ads render via `<AdSlot>`.
- **`<AdSlot>`** (`src/components/layout/AdSlot.astro`) checks `adsEnabled()` at
  build time. It only emits markup when ads are enabled, so closed builds ship
  zero ad code.
- **Placement rules (enforced):**
  - One unobtrusive banner per tool page (below the tool, never covering content).
  - Optional single banner on the landing page and/or search page footer area.
  - **No interstitials, no popups, no sticky overlays, no auto-playing video.**
  - Ads never delay tool interaction or first paint.
- **Download without ads.** Every tool page has a `<DownloadButton>` that links to
  the tool's folder in the GitHub repo so users can self-host ad-free. This button
  **only renders when `IS_OPEN_SOURCE=true`** (closed builds ship no source links).

### 4.4 Search system

The search page (`/search-tools`) has a **searchable list of all tools**. Search
matches tool **name** and **description** (and keywords).

- At build time, `src/lib/search.ts` reads the full registry and produces a
  lightweight search index: `{ id, name, shortDescription, keywords, category,
  subcategory, path }` for every tool.
- This index is inlined as props into the `<ToolSearch>` React island on the
  search page. (If the tool count grows very large, switch to a fetched JSON, but
  inlining is fine for hundreds of tools and avoids a network round trip.)
- **Fuse.js** powers fuzzy matching over `name` (high weight), `keywords` (medium),
  and `shortDescription` (lower weight).
- Results group by category. Empty query shows all tools grouped by category.
- Search works fully client-side (privacy-friendly, instant, offline-capable).

### 4.5 Landing page (`/`)

The landing page (`src/pages/index.astro`) is a marketing-style entry point, NOT
the tool list. It is statically generated with zero-JS by default and progressive
enhancement on top.

- **Hero** with large gradient headline and floating background blobs (pure CSS
  animations, `prefers-reduced-motion` aware).
- **Scroll-reveal** sections via a tiny `IntersectionObserver` inline script and
  the `.reveal` utility (see `src/styles/global.css`). Without JS, all content is
  visible.
- **Random-tool showcase.** A random subset of tools is picked at build time and
  rendered server-side (works without JS). The full tool list is inlined as JSON,
  and a "Shuffle" button re-picks client-side as progressive enhancement.
- **CTA** buttons link to `/search-tools` (browse all tools) and, when
  `IS_OPEN_SOURCE=true`, the GitHub repo.
- Category cards link to `/search-tools#<category>`.

Keep the landing page lean: no heavy islands, no tool JS. The only interactivity
is the theme toggle, scroll reveals, the shuffle button, and (when telemetry is
on) the settings menu, all tiny inline scripts. Do not move tool components onto
the landing page.

### 4.6 Telemetry & usage ranking

The site can collect **anonymous, opt-in usage telemetry** to power a "Most used
tools" leaderboard and total-usage stats on the landing page. Telemetry is
**independent of `IS_OPEN_SOURCE` and ads** — it is governed solely by
`GA_MEASUREMENT_ID`.

**Privacy model (non-negotiable):**

- All telemetry is **opt-in**. Nothing is sent anywhere until the user explicitly
  accepts.
- Data is **anonymous and aggregate only**: page paths and `tool_id`s. No user
  ids, no accounts, no IPs, no fingerprints, no personal data, no per-user
  tracking.
- The collection purpose is stated openly in the consent banner. The user can
  change their choice at any time from the settings (gear) icon.
- When `GA_MEASUREMENT_ID` is unset/empty, **zero telemetry code ships**: no GA
  script, no consent banner, no settings gear. The build is fully silent.

**How it works:**

- **Build-time gate** (`src/lib/telemetry.ts`, `telemetryAvailable()`): if
  `GA_MEASUREMENT_ID` is set, the BaseLayout emits the GA4 loader + a small
  inline script that boots `window.owtTelemetry` and sets Google **consent mode
  v2** with `analytics_storage: 'denied'` by default. This means GA4 queues (and
  drops) all hits until consent is granted — privacy-safe even before the user
  decides.
- **Consent** (`src/components/layout/ConsentBanner.astro`): on the very first
  visit (no `owt_consent` value in `localStorage`), a small non-intrusive banner
  explains what is collected and why, with **Allow** / **No thanks** buttons.
  The choice is stored in `localStorage` key `owt_consent` (`'accepted'` or
  `'declined'`). Accepting updates GA4 consent to `analytics_storage: 'granted'`.
  No popups, no sticky overlays, no auto-playing video — same "non-aggressive"
  rule as ads.
- **Settings** (`src/components/layout/SettingsMenu.astro`, gear icon in the
  Header): lets the user flip telemetry on/off at any time, read/writes the same
  `owt_consent` key, and updates GA4 consent. Only rendered when telemetry is
  available.
- **Client API** (`src/lib/track.ts`): thin typed wrappers around
  `window.owtTelemetry`. They **no-op** entirely if telemetry is unavailable or
  the user has not opted in. Tool authors import from here; they never touch
  `gtag` directly.

**Event taxonomy** (the only events tracked):

| Event | When | Fired by | Signals |
|---|---|---|---|
| `page_view` | any page loads | GA4 automatic (gated by consent) | traffic / discovery |
| `tool_open` | a tool island hydrates | `ToolIsland.tsx` (automatic) | viewed the tool |
| `tool_use` | a meaningful primary action | the tool component (manual) | actually used it |

`tool_use` is the strongest ranking signal; `tool_open` is a weaker secondary
signal. `page_view` populates overall traffic.

**Leaderboard & total-usage stats (build-time):**

Cross-user ranking requires aggregate data from GA4, which is a server-side
operation. To stay 100% client-side at runtime, ranking data is **baked into the
static build**:

1. `scripts/fetch-usage.mjs` queries the **GA4 Data API** (needs a service
   account + `GA4_PROPERTY_ID` + `GA4_CREDENTIALS_PATH`, see §11) for
   `tool_use` / `tool_open` event counts grouped by `tool_id`, and writes
   `src/data/usage.json`.
   - **You MUST register `tool_id` as a custom event-scoped dimension** in GA4
     Admin, otherwise the Data API cannot report on it.
2. `src/lib/usage.ts` reads `src/data/usage.json` (always present; empty until
   the script runs) and exposes `hasUsageData()`, `topTools(n)`, `usageTotals()`.
3. `src/pages/index.astro` renders a "Most used tools" leaderboard + a
   total-usage stat card **only when `hasUsageData()` is true**. If you never run
   the fetch script, those sections simply do not render — the site still builds
   and works.

Ranking score = `tool_uses * 5 + tool_opens` (configurable in `src/lib/usage.ts`).

**Adding telemetry to a new tool (the one line that matters):**

Every tool already gets `tool_open` tracked automatically (the `ToolIsland`
mount hook). To capture real *usage*, add a single `trackToolUse(toolId, category)`
call the first time the user does the tool's primary action (e.g. clicking
"Calculate", "Convert", "Run"). The canonical example is in
`src/tools/financial/mortgage-calculator/MortgageCalculator.tsx`. See §6 Step 3
for the exact pattern. Do NOT spam `trackToolUse` on every keystroke — fire it
once per meaningful session.

---

## 5. Tool Registry System

### 5.1 The `Tool` interface (`src/types/tool.ts`)

```ts
export type ToolStatus = 'active' | 'beta' | 'experimental';

export interface ToolSeo {
  title: string;        // < 60 chars, includes primary keyword
  description: string;  // < 160 chars, compelling, includes keyword
  keywords: string[];   // SEO keywords (also feed search)
}

export interface Tool {
  id: string;                  // unique kebab-case slug, e.g. "mortgage-calculator"
  name: string;                // display name, e.g. "Mortgage Calculator"
  shortDescription: string;    // <= 100 chars, shown on cards + search preview
  description: string;         // 2-4 sentences, full description for tool page + SEO
  category: string;            // category slug (must exist in src/data/categories.ts)
  subcategory?: string;        // optional subcategory slug
  keywords: string[];          // search + SEO keywords
  icon: string;                // emoji or icon id shown on cards/nav
  component: () => Promise<any>;  // lazy import: () => import('./Calculator.tsx')
  heavy?: boolean;             // true if large deps (WASM, LLM). Forces client:visible + skeleton.
  featured?: boolean;          // show on landing page featured row
  status: ToolStatus;          // 'active' | 'beta' | 'experimental'
  seo: ToolSeo;                // per-tool SEO metadata
  tags?: string[];             // optional freeform tags
}
```

### 5.2 How registration works

1. Every **category** is a folder under `src/tools/<category>/` and MUST contain a
   `_registry.ts` that default-exports an array of `Tool` objects.
2. `src/lib/registry.ts` uses `import.meta.glob('../tools/**/_registry.ts',
   { eager: true })` to auto-discover and aggregate ALL category registries into a
   single `allTools` array. **You never edit `registry.ts` to add a tool.** Just
   add the tool to its category's `_registry.ts`.
3. `src/data/categories.ts` defines category display names, slugs, icons, and
   optional subcategories. A tool's `category`/`subcategory` MUST match an entry
   here or the build fails validation.

### 5.3 The dynamic tool page

`src/pages/tools/[category]/[tool].astro` uses `getStaticPaths()` to generate one
static page per tool from `allTools`. It reads the `Tool` object and renders:
`ToolLayout` (with SEO meta, and ad slot + download button only when
`IS_OPEN_SOURCE=true`) + the tool's React island
via the `component` lazy import.

---

## 6. Creating a New App — COMPLETE WORKFLOW

When told **"Create an app that does X"**, follow these steps in order. Do not skip
any. Each step is required for the tool to be valid, discoverable, and SEO-ready.

### Step 1 — Classify the tool

- Decide the **category**. Check `src/data/categories.ts` for existing categories.
  - If a fitting category exists → use it.
  - If not → add a new category to `src/data/categories.ts` (slug, name, icon,
    optional subcategories). See §7 for when to create subcategories.
- Decide `status`: `active` (production-ready), `beta` (works but polishing),
  `experimental` (rough). Default to `beta` until you've tested it.
- Set `heavy: true` if the tool needs WASM, a model download, or > ~500 KB of deps.

### Step 2 — Scaffold the tool folder

Create `src/tools/<category>/<tool-id>/` where `<tool-id>` is a kebab-case slug.
Inside it create:
- `index.ts` — the tool definition (exports a `Tool` object).
- `<ComponentName>.tsx` — the React island (the actual UI/logic).

Name the component in PascalCase, matching the tool (e.g. `MortgageCalculator.tsx`).

### Step 3 — Write the component

- Export a default React component.
- Keep it self-contained. If it needs heavy deps, import them lazily inside the
  component (dynamic import) and render a skeleton while loading.
- If CPU-heavy, offload to a Web Worker placed alongside the component
  (`<ComponentName>.worker.ts`).
- Make it fully responsive and keyboard-accessible.
- Do NOT add any network calls. Everything is local.
- **Track real usage (telemetry).** `tool_open` is already tracked
  automatically when the island hydrates (you do nothing). To count a tool as
  *used*, fire `trackToolUse(toolId, category)` once, the first time the user
  performs the tool's primary action (e.g. clicking "Calculate", "Convert",
  "Run"). Import it from `src/lib/track.ts` and guard it so it only fires once
  per session. Do NOT call it on every keystroke. Canonical example:
  `src/tools/financial/mortgage-calculator/MortgageCalculator.tsx`. This call is
  a no-op when telemetry is off (no `GA_MEASUREMENT_ID`) or the user has not
  opted in, so it is always safe to include.

```tsx
import { useEffect, useRef } from 'react';
import { trackToolUse } from '../../../lib/track';

const usedRef = useRef(false);
useEffect(() => {
  const handler = () => {
    if (usedRef.current) return;
    usedRef.current = true;
    trackToolUse('<tool-id>', '<category>');
    document.removeEventListener('input', handler, true);
  };
  document.addEventListener('input', handler, true);
  return () => document.removeEventListener('input', handler, true);
}, []);
```

### Step 4 — Write the tool definition (`index.ts`)

```ts
import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'mortgage-calculator',
  name: 'Mortgage Calculator',
  shortDescription: 'Estimate monthly mortgage payments from loan amount, rate, and term.',
  description: '...generated via the description prompt (Step 5)...',
  category: 'financial',
  subcategory: 'loans',            // optional
  keywords: ['mortgage', 'loan', 'interest', 'monthly payment', 'amortization'],
  icon: '🏦',
  component: () => import('./MortgageCalculator.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Mortgage Calculator — Free & Offline',
    description: 'Calculate monthly mortgage payments, interest, and amortization. Runs entirely in your browser. No data leaves your device.',
    keywords: ['mortgage calculator', 'loan payment calculator', 'amortization'],
  },
};

export default tool;
```

### Step 5 — Generate the description (MANDATORY)

Use the writing assistant prompt below to produce BOTH `description` (2-4
sentences for the tool page + SEO) and `shortDescription` (<= 100 chars for cards).
The `description` must be honest, plain, and human — no hype, no AI giveaway
phrases. See §8 for the full prompt.

### Step 6 — Fill in SEO metadata

- `seo.title` < 60 chars, primary keyword near the start, include "Free" or
  "Offline" where honest.
- `seo.description` < 160 chars, includes the keyword, compels a click without
  hype.
- `seo.keywords` — 3-7 relevant terms people actually search.
- `keywords` (top-level) — broader set used for the in-site search index. Include
  synonyms and common misspellings worth matching.

### Step 7 — Register the tool

Add an import + entry in the category's `_registry.ts`:

```ts
// src/tools/financial/_registry.ts
import type { Tool } from '../../types/tool';
import mortgage from './mortgage-calculator';

export const tools: Tool[] = [
  mortgage,
  // ...other financial tools
];
```

The aggregator in `src/lib/registry.ts` picks this up automatically. No other
registration is needed.

### Step 8 — Validate

Run `npm run validate-tool -- <tool-id>` (uses `scripts/validate-tool.mjs`). It
checks:
- `id` is unique kebab-case.
- `category`/`subcategory` exist in `categories.ts`.
- `shortDescription` <= 100 chars; `seo.title` < 60; `seo.description` < 160.
- `component` is a function (lazy import), not a direct import.
- `heavy` tools use `client:visible` (enforced in the page template).
- No duplicate keywords.

Fix everything it reports before finishing.

### Step 9 — Test locally

- `npm run dev` → open `/search-tools`, confirm the new tool appears in search and
  under its category.
- Navigate to `/tools/<category>/<tool-id>` → confirm it loads, the ad slot and
  download button render only when `IS_OPEN_SOURCE=true` (set `ADSENSE_CLIENT_ID`
  too for ads), and meta tags are correct (view source).
- With `GA_MEASUREMENT_ID` set: confirm the consent banner appears on first
  visit, the settings gear toggles analytics, and your tool fires `tool_use` on
  its primary action (check the Network tab for the `tool_use` event after
  opting in). With `GA_MEASUREMENT_ID` unset, none of this code should ship.
- `npm run build` → confirm the static page generates with no errors.
- `npm run lighthouse` on the tool page → confirm SEO + Performance scores are
  green.

### Step 10 — Self-check against the checklist

Run through the **Validation Checklist** in §10. If every box is checked, the tool
is done.

---

## 7. Category & Section Management

- Categories map to top-level folders under `src/tools/` and top-level URL segments
  (`/tools/<category>/`).
- **Create a subcategory** when a single category has **more than ~8 tools** or
  when tools naturally split into distinct groups (e.g. `financial` → `loans`,
  `investing`, `taxes`). Subcategories are optional and defined in
  `src/data/categories.ts`.
- Subcategories are NOT separate URL segments by default — they group tools within
  a category page and in search results. (If a category grows large enough to need
  its own landing page, add a `src/pages/tools/<category>/index.astro` listing.)
- **Naming:** category and subcategory slugs are kebab-case. Display names are
  Title Case. Icons are a single emoji.
- **Renaming a category** requires updating `categories.ts`, the folder name, every
  `_registry.ts` `category` field, and the generated URLs. Add a redirect if the
  site is already indexed.

---

## 8. Description Generation Prompt

When generating any user-facing text for a tool (`description`,
`shortDescription`, README copy), use this prompt. Feed it the tool's purpose,
audience, and any must-keep terms, then use its output verbatim (lightly trimmed
to length limits).

> You are a writing assistant trained decades to write in a clear, natural, and honest tone. Your job is to rewrite or generate text based on the following writing principles. Here's what I want you to do: → Use simple language — short, plain sentences. → Avoid AI giveaway phrases like "dive into," "unleash," or "game-changing." → Be direct and concise — cut extra words. → Maintain a natural tone — write like people actually talk. It's fine to start with "and" or "but." → Skip marketing language — no hype, no exaggeration. → Keep it honest — don't fake friendliness or overpromise. → Simplify grammar — casual grammar is okay if it feels more human. → Cut the fluff — skip extra adjectives or filler words. → Focus on clarity — make it easy to understand. → Target audience (optional): [$Insert who it's for, if relevant] → Any must-keep terms, details, or formatting: [$ List anything that must stay intact] Constraints (Strict No-Use Rules): → Do not use emdashes ( - ) in writing → Do not use lists or sentence structures with "X and also Y" → Do not use colons ( : ) unless part of input formatting → Avoid rhetorical questions like "Have you ever wondered…?" → No fake engagement phrases like "Let's take a look," "Join me on this journey," or "Buckle up" Most Important: → Match the tone to feel human, authentic and not robotic or promotional. → Ask me any clarifying questions before you start if needed. → Ask me any follow-up questions if the original input is vague or unclear

**Usage notes for this project:**
- For `shortDescription`: ask the prompt for a single sentence <= 100 chars.
- For `description`: ask for 2-4 plain sentences. Then trim to fit if needed.
- Always state that the tool runs entirely in the browser / offline, when true.
- Never claim features the tool doesn't have.

---

## 9. SEO Best Practices (applied per tool)

Carry these into every new tool. They are enforced partly by `seo.ts` and the
validation script, partly by discipline.

1. **Title tag** < 60 chars, primary keyword near the start.
2. **Meta description** < 160 chars, keyword included, no hype.
3. **One `<h1>`** = the tool name. Logical `<h2>`/`<h3>` structure below.
4. **URL** is `/tools/<category>/<tool-id>` (kebab-case, clean).
5. **JSON-LD** `SoftwareApplication` schema on every tool page (via `seo.ts`).
6. **Internal links** from the category listing and search to the tool page, using
  the tool name as anchor text.
7. **Image alt text** on any tool screenshots/og images.
8. **Mobile-first**, responsive, tap targets >= 44px.
9. **Fast**: zero-JS shell, `client:visible` island, lazy heavy deps, Web Workers.
10. **Sitemap** + **robots.txt** auto-generated; submit sitemap in Google Search
    Console.
11. **Open Graph + Twitter card** per page (via `seo.ts`).
12. Run `npm run lighthouse` — target SEO 100, Performance >= 90 on the tool page.

---

## 10. Validation Checklist (run before declaring a tool done)

- [ ] Tool folder is `src/tools/<category>/<tool-id>/` with `index.ts` + component.
- [ ] `index.ts` exports a complete `Tool` object with every required field.
- [ ] `component` is a lazy `() => import(...)`, not a static import.
- [ ] `category` (and `subcategory` if set) exists in `src/data/categories.ts`.
- [ ] `id` is unique and kebab-case.
- [ ] `description` + `shortDescription` generated via the §8 prompt (honest, plain).
- [ ] `shortDescription` <= 100 chars.
- [ ] `seo.title` < 60 chars; `seo.description` < 160 chars.
- [ ] `keywords` include synonyms a user might type in search.
- [ ] Tool added to its category `_registry.ts` (and only there).
- [ ] If `heavy: true`, the page uses `client:visible` and shows a loading skeleton.
- [ ] No network calls in the component (client-side only).
- [ ] **Telemetry:** fires `trackToolUse(toolId, category)` once on the tool's
      primary action (import from `src/lib/track.ts`). `tool_open` is automatic.
      This is a safe no-op when telemetry is off. (See §4.6.)
- [ ] `<DownloadButton>` present **only when `IS_OPEN_SOURCE=true`** (links to
      the tool's GitHub folder; closed builds ship no source links).
- [ ] `<AdSlot>` placement follows the non-aggressive rules (§4.3) and only
      renders when `IS_OPEN_SOURCE=true` and `ADSENSE_CLIENT_ID` is set.
- [ ] `npm run validate-tool -- <tool-id>` passes.
- [ ] `npm run build` succeeds; the static page is generated.
- [ ] `npm run lighthouse` on the tool page: SEO 100, Performance >= 90.
- [ ] Search page (`/search-tools`) finds the tool by name, keyword, and description text.

---

## 11. Environment Variables

Defined in `.env.example`. All are optional (the site runs fully private and
ad-free without any).

| Variable | Purpose | Default | Example |
|---|---|---|---|
| `IS_OPEN_SOURCE` | Master toggle. `true` enables GitHub links, "open source" copy, and ad slots. Anything else (or unset) keeps all of that off. | `false` (unset) | `true` |
| `ADSENSE_CLIENT_ID` | AdSense client id. Only used when `IS_OPEN_SOURCE=true`. Empty → no ad code shipped. | empty | `ca-pub-1234567890123456` |
| `SITE_URL` | Canonical/base URL for SEO + sitemap + Open Graph tags. | `https://offline-web-tools.com` | `https://yourdomain.com` |
| `GITHUB_REPO_URL` | Base URL for GitHub source links + "get without ads" buttons. Only used when `IS_OPEN_SOURCE=true`. | `https://github.com/your-org/OfflineWebTools` | `https://github.com/<org>/OfflineWebTools` |
| `GA_MEASUREMENT_ID` | Google Analytics 4 measurement id for **anonymous, opt-in usage telemetry**. INDEPENDENT of `IS_OPEN_SOURCE`. Empty/unset → no telemetry at all (no GA script, no consent banner, no settings menu, zero tracking code). When set, users see a one-time opt-in popup; nothing is sent until they accept. | empty | `G-XXXXXXXXXX` |
| `GA4_PROPERTY_ID` | GA4 property id, only used by the optional build-time `npm run fetch-usage` script that bakes the leaderboard into the static build. Not used at runtime. | empty | `properties/123456789` |
| `GA4_CREDENTIALS_PATH` | Path to a GA4 service-account JSON key authorized for the Data API. Only used by `npm run fetch-usage`. | empty | `/path/to/sa.json` |

- `IS_OPEN_SOURCE` unset/false (default) → no GitHub links, no "open source"
  copy, no ad script, no `<AdSlot>` markup, no `<DownloadButton>`. This is the
  private / closed deployment and the self-hosted behavior.
- `IS_OPEN_SOURCE=true` → GitHub links and open-source copy show. Ads render
  **only if** `ADSENSE_CLIENT_ID` is also set. (The open-source hosted
  deployment shows ads; users who want it ad-free self-host or grab a single
  tool via the `<DownloadButton>` GitHub link. That is the intended escape
  hatch — ads are NOT removed from the open-source build.)
- `GA_MEASUREMENT_ID` is **independent** of `IS_OPEN_SOURCE`. You may enable
  telemetry on a private build (no ads, no GitHub links) by setting
  `GA_MEASUREMENT_ID` alone. You may enable both ads and telemetry on the
  open-source build by setting `IS_OPEN_SOURCE=true`, `ADSENSE_CLIENT_ID`, and
  `GA_MEASUREMENT_ID`. See §4.6 for the full telemetry model.
- `SITE_URL` drives canonical URLs, OG tags, and the sitemap.

---

## 12. Code Style & Conventions

- **TypeScript** for all `.ts`/`.tsx`. No `any` unless interfacing with an
  untyped library (then add a narrow comment-free type guard).
- **kebab-case** for folders, tool ids, URL segments. **PascalCase** for React
  components and TS interfaces/types.
- One tool per folder. Keep all of a tool's files (component, worker, assets)
  inside its folder.
- Styling via **Tailwind utility classes**. No bespoke CSS files per tool unless
  unavoidable; if needed, co-locate as `<Tool>.css` and import in the component.
- Keep tool components **self-contained**. Shared UI primitives live in
  `src/components/ui/`. Reuse them; don't reinvent buttons/inputs.
- **Accessibility:** semantic HTML, labels on inputs, focus-visible styles,
  sufficient color contrast, keyboard operability.
- Comments: only where a non-obvious algorithm needs it. Prefer clear names over
  comments.

---

## 13. Build & Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run validate-tool -- <id>` | Validate a single tool registration |
| `npm run fetch-usage` | OPTIONAL: pull GA4 usage counts into `src/data/usage.json` (needs `GA4_PROPERTY_ID` + `GA4_CREDENTIALS_PATH`; run before `build` for the leaderboard) |
| `npm run lighthouse` | Run Lighthouse CI on key pages (SEO + perf) |
| `npm run typecheck` | `astro check && tsc --noEmit` type check |
| `npm test` | Run unit + e2e tests |

### Deploying the hosted (open-source, ad-enabled) build

```
IS_OPEN_SOURCE=true \
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx \
SITE_URL=https://offline-web-tools.com \
GITHUB_REPO_URL=https://github.com/<org>/OfflineWebTools \
GA_MEASUREMENT_ID=G-XXXXXXXXXX \
npm run build
```

Then deploy `dist/` to any static host. Ads only render when both
`IS_OPEN_SOURCE=true` and `ADSENSE_CLIENT_ID` are set. Telemetry (the consent
banner + settings gear) only renders when `GA_MEASUREMENT_ID` is set, and
nothing is sent to Google until a user opts in. To bake the "Most used tools"
leaderboard into the build, run `npm run fetch-usage` first (needs
`GA4_PROPERTY_ID` + `GA4_CREDENTIALS_PATH`); otherwise the leaderboard section
simply does not render.

### Self-hosting (private, ad-free)

```
SITE_URL=https://yourdomain.com \
npm run build
```

`IS_OPEN_SOURCE` unset (default) → no GitHub links, no ads, no open-source copy.
Set `GA_MEASUREMENT_ID` only if you also want anonymous opt-in telemetry on your
self-hosted build; otherwise omit it for a fully silent, zero-tracking build.

---

## 14. "Create an app that does X" — Agent quick reference

When you receive a request like **"Create an app that does Y"**, the entire
context you need is above. In short:

1. Classify → category + status + heavy? (§6.1, §7)
2. Scaffold folder + component (§6.2, §6.3)
3. Write `index.ts` tool definition (§6.4)
4. Generate descriptions with the §8 prompt
5. Fill SEO fields (§6.6, §9)
6. Register in category `_registry.ts` ONLY (§6.7)
7. `npm run validate-tool -- <id>` (§6.8)
8. `npm run dev` + `npm run build` + `npm run lighthouse` (§6.9)
9. Walk the §10 checklist.

You should be able to complete all of this without asking the user further
questions, using sensible defaults. Only ask the user if the request is genuinely
ambiguous about what the tool should do.
