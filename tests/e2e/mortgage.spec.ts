import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/mortgage-calculator';

test.describe('Mortgage Calculator', () => {
  test('computes a monthly payment and shows chart and table', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#loan').fill('100000');
    await page.locator('#rate').fill('5');
    await page.locator('#years').fill('30');
    await page.getByRole('button', { name: 'Calculate' }).click();

    // monthly payment renders as a formatted currency string (digits present)
    const monthly = await page.locator('.text-4xl').first().textContent();
    expect(monthly).toBeTruthy();
    expect(monthly).toMatch(/[0-9]/);

    // amortization chart + schedule sections appear
    await expect(page.getByRole('heading', { name: 'Balance & cumulative payments' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Amortization schedule' })).toBeVisible();

    // yearly summary by default (30 rows for a 30y loan)
    await expect(page.locator('table tbody tr')).toHaveCount(30);
  });

  test('toggles the schedule to a monthly breakdown', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#loan').fill('50000');
    await page.locator('#rate').fill('6');
    await page.locator('#years').fill('5');
    await page.getByRole('button', { name: 'Calculate' }).click();

    // default yearly = 5 rows
    await expect(page.locator('table tbody tr')).toHaveCount(5);
    await page.getByLabel('Show monthly breakdown').check();
    // monthly = 60 rows
    await expect(page.locator('table tbody tr')).toHaveCount(60);
  });

  test('validates zero loan with an error message', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#loan').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.locator('[class*="text-red"]')).toBeVisible();
  });
});
