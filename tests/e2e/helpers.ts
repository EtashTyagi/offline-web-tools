import type { Page } from '@playwright/test';

/**
 * Navigate to a URL and wait for Astro `client:visible` islands to hydrate.
 *
 * Astro server-renders each tool's full UI to static HTML, so the interactive
 * elements are present immediately but React does not attach event handlers
 * until the island's chunk loads and hydrates. `networkidle` waits for that
 * chunk (and its deps) to finish loading, after which clicks/selects work.
 * We also scroll the article into view to trigger the IntersectionObserver.
 */
export async function gotoReady(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' });
  // Scroll the tool article into view to trigger the `client:visible`
  // IntersectionObserver. Only do this when an article exists (tool pages).
  const article = page.locator('article').first();
  if ((await article.count()) > 0) {
    await article.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => {});
  }
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}
