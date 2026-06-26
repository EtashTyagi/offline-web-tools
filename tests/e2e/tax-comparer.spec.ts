import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const URL_ = '/tools/financial/tax-comparer';
const COUNTRY_COUNT = 8;

test.describe('Tax Comparer', () => {
  test('compares all countries from one income with charts and a table', async ({ page }) => {
    await gotoReady(page, URL_);

    await expect(page.getByRole('heading', { name: 'Tax Comparer', level: 1 })).toBeVisible();
    await page.locator('#gross').fill('60000');
    await page.getByRole('button', { name: 'Compare' }).click();

    // Summary cards
    await expect(page.getByText('Lowest total tax')).toBeVisible();
    await expect(page.getByText('Highest total tax')).toBeVisible();
    await expect(page.getByText('Tax spread')).toBeVisible();

    // Charts
    await expect(page.getByRole('heading', { name: 'Effective tax rate by country' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Total tax/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Take-home pay/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Marginal vs effective rate' })).toBeVisible();

    // Ranking list, one entry per country
    await expect(page.getByRole('heading', { name: 'Ranked by tax burden' })).toBeVisible();
    await expect(page.locator('section[aria-label="Tax burden ranking"] ol li')).toHaveCount(COUNTRY_COUNT);

    // Full comparison table, one row per country
    await expect(page.getByRole('heading', { name: 'Full comparison' })).toBeVisible();
    await expect(page.locator('section[aria-label="Full comparison table"] tbody tr')).toHaveCount(COUNTRY_COUNT);

    // Per-country info cards
    await expect(page.getByRole('heading', { name: 'What each estimate includes' })).toBeVisible();
    await expect(page.locator('section[aria-label="Country details"] .grid > div')).toHaveCount(COUNTRY_COUNT);
  });

  test('lowest and highest tax countries differ for a high income', async ({ page }) => {
    await gotoReady(page, URL_);
    await page.locator('#gross').fill('200000');
    await page.getByRole('button', { name: 'Compare' }).click();

    await expect(page.getByText('Lowest total tax')).toBeVisible();
    await expect(page.getByText('Highest total tax')).toBeVisible();

    // The lowest and highest summary cards each show a 2-letter country code;
    // they should not match for a high income.
    const codeCells = page.locator('p.text-2xl');
    const lowCode = (await codeCells.nth(0).textContent()) ?? '';
    const highCode = (await codeCells.nth(1).textContent()) ?? '';
    expect(lowCode.trim()).not.toEqual(highCode.trim());
  });

  test('re-runs when the base currency changes', async ({ page }) => {
    await gotoReady(page, URL_);
    await page.locator('#gross').fill('60000');
    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.locator('section[aria-label="Full comparison table"] tbody tr')).toHaveCount(COUNTRY_COUNT);

    await page.locator('#base-currency').selectOption('EUR');
    await page.getByRole('button', { name: 'Compare' }).click();
    // Column header relabels to EUR
    await expect(page.locator('th', { hasText: 'Total tax (EUR)' })).toBeVisible();
    await expect(page.locator('section[aria-label="Full comparison table"] tbody tr')).toHaveCount(COUNTRY_COUNT);
  });

  test('shows an error for zero income', async ({ page }) => {
    await gotoReady(page, URL_);
    await page.locator('#gross').fill('0');
    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Full comparison' })).toHaveCount(0);
  });
});
