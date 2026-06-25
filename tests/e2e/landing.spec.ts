import { test, expect } from '@playwright/test';

test.describe('landing page', () => {
  test('renders hero, stats, and a shuffle button that re-renders tools', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Tools that respect/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse all tools/ }).first()).toBeVisible();

    // stats grid shows a tool count
    await expect(page.locator('dl')).toBeVisible();

    // the showcase grid initially renders tool cards
    const grid = page.locator('#showcase-grid');
    await expect(grid.locator('a')).not.toHaveCount(0);

    // collect the set of tool titles shown before shuffling
    const knownTitles = new Set((await grid.locator('h3').allInnerTexts()).map((t) => t.trim()));

    // clicking shuffle re-renders the grid: it still shows only known tools
    await page.locator('#shuffle-btn').click();
    await expect(grid.locator('a')).not.toHaveCount(0);
    const titles = await grid.locator('h3').allInnerTexts();
    for (const t of titles) {
      expect(knownTitles.size === 0 || knownTitles.has(t.trim())).toBeTruthy();
    }
  });

  test('category cards link to /search-tools#<slug>', async ({ page }) => {
    await page.goto('/');
    const devCard = page.getByRole('link', { name: /Developer/ }).first();
    await expect(devCard).toHaveAttribute('href', /\/search-tools#dev/);
  });

  test('does not show GitHub links in the default closed build', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'View on GitHub' })).toHaveCount(0);
  });
});
