// Build-time usage ingestion for the "Most used tools" leaderboard + total
// usage stats shown on the landing page.
//
// This is OPTIONAL and only needed if you want the leaderboard baked into the
// static build. It reads aggregate (anonymous) counts from the Google
// Analytics 4 Data API and writes src/data/usage.json. The build then reads
// that file at compile time (see src/lib/usage.ts). If you never run this, the
// leaderboard and usage stats simply do not render (usage.json stays empty).
//
// Requirements:
//   npm install @google-analytics/data
//   GA4_PROPERTY_ID=properties/123456789      (GA4 property id)
//   GA4_CREDENTIALS_PATH=/path/to/service-account.json
//
// In GA4 Admin you MUST register `tool_id` as a custom event-scoped dimension,
// otherwise the Data API cannot report on it. The events used are:
//   - tool_use  (fired by tools on a meaningful primary action)
//   - tool_open (fired automatically when a tool island hydrates)
//
// Usage:
//   npm run fetch-usage [-- --days 30]
//
// After it writes usage.json, run a normal `npm run build`.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';
const CREDENTIALS_PATH = process.env.GA4_CREDENTIALS_PATH || '';

const argv = process.argv.slice(2);
const daysIdx = argv.indexOf('--days');
const DAYS =
  daysIdx !== -1 && argv[daysIdx + 1] ? parseInt(argv[daysIdx + 1], 10) : 30;

function loadRegistryToolIds() {
  const cats = readFileSync(resolve(root, 'src/data/categories.ts'), 'utf8');
  const slugs = [...cats.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return new Set(slugs);
}

async function main() {
  if (!PROPERTY_ID || !CREDENTIALS_PATH) {
    console.error(
      '\n✗ Missing GA4 configuration.\n' +
        '  Set GA4_PROPERTY_ID (e.g. properties/123456789) and\n' +
        '  GA4_CREDENTIALS_PATH (path to a service-account JSON key).\n' +
        '  Also run: npm install @google-analytics/data\n' +
        '  See scripts/fetch-usage.mjs for full requirements.\n',
    );
    process.exit(1);
  }

  let BetaAnalyticsDataClient;
  try {
    ({ BetaAnalyticsDataClient } = await import('@google-analytics/data'));
  } catch {
    console.error(
      '\n✗ @google-analytics/data is not installed.\n' +
        '  Run: npm install @google-analytics/data\n',
    );
    process.exit(1);
  }

  const client = new BetaAnalyticsDataClient({ keyFilename: CREDENTIALS_PATH });

  const startDate = `${DAYS}daysAgo`;
  const dateRanges = [{ startDate, endDate: 'today' }];

  async function countsFor(eventName) {
    const [response] = await client.runReport({
      property: PROPERTY_ID,
      dateRanges,
      dimensions: [{ name: 'customEvent:tool_id' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: eventName },
        },
      },
    });
    const map = new Map();
    for (const row of response.rows || []) {
      const toolId = row.dimensionValues?.[0]?.value;
      const count = Number(row.metricValues?.[0]?.value ?? 0);
      if (toolId) map.set(toolId, (map.get(toolId) || 0) + count);
    }
    return map;
  }

  console.log(`Fetching last ${DAYS} days of usage from ${PROPERTY_ID} ...`);
  const [useMap, openMap] = await Promise.all([
    countsFor('tool_use'),
    countsFor('tool_open'),
  ]);

  const validSlugs = loadRegistryToolIds();
  const ids = new Set([...useMap.keys(), ...openMap.keys()]);
  const tools = [];
  let totalUses = 0;
  let totalOpens = 0;
  for (const id of ids) {
    const uses = useMap.get(id) || 0;
    const opens = openMap.get(id) || 0;
    totalUses += uses;
    totalOpens += opens;
    const category = String(id).split('-')[0];
    if (!validSlugs.has(category)) {
      console.warn(`  ! skipping unknown tool_id "${id}" (no matching category)`);
      continue;
    }
    tools.push({ id, name: '', icon: '', category, path: '', uses, opens });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    totals: {
      totalUses,
      totalOpens,
      uniqueTools: tools.length,
    },
    tools,
  };

  const outPath = resolve(root, 'src/data/usage.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`\n✓ Wrote ${tools.length} tools to ${outPath}`);
  console.log(`  total tool_use events: ${totalUses}`);
  console.log(`  total tool_open events: ${totalOpens}`);
  console.log('  Run `npm run build` to bake the leaderboard into the site.');
}

main().catch((err) => {
  console.error('\n✗ fetch-usage failed:');
  console.error(err);
  process.exit(1);
});
