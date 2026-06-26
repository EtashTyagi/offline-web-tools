import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const HUB_URL = '/tools/financial/tax-calculators';

const COUNTRY_PATHS = [
  '/tools/financial/us-income-tax-calculator',
  '/tools/financial/india-income-tax-calculator',
  '/tools/financial/uk-income-tax-calculator',
  '/tools/financial/germany-income-tax-calculator',
  '/tools/financial/france-income-tax-calculator',
  '/tools/financial/spain-income-tax-calculator',
  '/tools/financial/italy-income-tax-calculator',
  '/tools/financial/netherlands-income-tax-calculator',
];

test.describe('Tax Calculators hub', () => {
  test('lists a card for every country plus the comparer link', async ({ page }) => {
    await gotoReady(page, HUB_URL);

    await expect(page.getByRole('heading', { name: 'Tax Calculators', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Country income tax calculators' })).toBeVisible();

    for (const path of COUNTRY_PATHS) {
      await expect(page.locator(`a[href="${path}"]`)).toBeVisible();
    }
  });

  test('links to the Tax Comparer', async ({ page }) => {
    await gotoReady(page, HUB_URL);
    const link = page.getByRole('link', { name: /Compare countries/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/tools/financial/tax-comparer');
  });

  test('navigates to a country calculator when its card is clicked', async ({ page }) => {
    await gotoReady(page, HUB_URL);
    await page.locator(`a[href="/tools/financial/us-income-tax-calculator"]`).click();
    await expect(page).toHaveURL(/\/tools\/financial\/us-income-tax-calculator/);
    await expect(page.getByRole('heading', { name: 'US Income Tax Calculator', level: 1 })).toBeVisible();
  });
});
