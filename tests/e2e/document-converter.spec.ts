import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const URL = '/tools/files/document-converter';

// The pandoc WASM engine (~56 MB) is preloaded in the background on page open.
// The first conversion may still have to wait for that preload to finish, so
// allow plenty of time. Subsequent conversions on the same page are instant.
test.describe('Document Converter', () => {
  test.setTimeout(240_000);

  test('preloads the engine in the background on page open (no Convert click)', async ({ page }) => {
    const wasmRequests: string[] = [];
    page.on('request', (req) => {
      if (/pandoc.*wasm/i.test(req.url())) wasmRequests.push(req.url());
    });
    await gotoReady(page, URL);
    // The engine must start fetching as soon as the page opens, without the
    // user clicking Convert.
    expect(wasmRequests.length).toBeGreaterThan(0);
  });

  test('shows the background-loading banner while the engine downloads', async ({ page }) => {
    // Stall only the runtime WASM fetch (plain URL, no query) so the
    // non-blocking banner stays observable. The `?import&url` module-resolution
    // request is left alone so the worker still loads.
    let resolveDelay: () => void = () => {};
    const delay = new Promise<void>((r) => { resolveDelay = r; });
    await page.route(
      (url) => url.pathname.endsWith('/pandoc.wasm') && url.search === '',
      async (route) => {
        await delay;
        await route.continue();
      },
    );

    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.locator('article').first().scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => {});
    await expect(page.getByText(/Loading the pandoc engine in the background/i)).toBeVisible({ timeout: 15_000 });
    resolveDelay();
  });

  test('converts Markdown to HTML and toggles standalone', async ({ page }) => {
    await gotoReady(page, URL);

    await page.getByRole('button', { name: 'Sample' }).click();
    await page.getByRole('button', { name: /^Convert/ }).click();

    // Standalone is on by default -> full HTML document.
    await expect.poll(
      async () => page.locator('textarea[readonly]').inputValue(),
      { timeout: 180_000, intervals: [1000] },
    ).toContain('<h1');
    const full = await page.locator('textarea[readonly]').inputValue();
    expect(full).toContain('Hello World');
    expect(full.toLowerCase()).toContain('<!doctype');

    // Turn off standalone -> just a fragment.
    await page.getByLabel('Standalone document').uncheck();
    await page.getByRole('button', { name: /^Convert/ }).click();
    await expect.poll(
      async () => page.locator('textarea[readonly]').inputValue(),
      { timeout: 30_000, intervals: [500] },
    ).toContain('<h1');
    const frag = await page.locator('textarea[readonly]').inputValue();
    expect(frag.toLowerCase()).not.toContain('<!doctype');
  });

  test('converts HTML to GitHub-Flavored Markdown', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('#from').selectOption('html');
    await page.locator('#to').selectOption('gfm');
    await page.locator('textarea').first().fill('<h1>Hello World</h1>\n<p>Some <strong>bold</strong> text.</p>');
    await page.getByRole('button', { name: /^Convert/ }).click();

    await expect.poll(
      async () => page.locator('textarea[readonly]').inputValue(),
      { timeout: 180_000, intervals: [1000] },
    ).toContain('Hello World');
    const md = await page.locator('textarea[readonly]').inputValue();
    expect(md).toContain('# Hello World');
    expect(md).toContain('**bold**');
  });

  test('produces a binary docx download', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await page.locator('#to').selectOption('docx');
    await page.getByRole('button', { name: /^Convert/ }).click();

    await expect(page.getByRole('button', { name: /Download document\.docx/i })).toBeVisible({ timeout: 180_000 });
  });
});
