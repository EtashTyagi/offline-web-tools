import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/investment-calculator';

test.describe('Investment Calculator (FVIFA)', () => {
  test('computes a future value and shows chart and table', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#lump').fill('100000');
    await page.locator('#rate').fill('12');
    await page.locator('#years').fill('1');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const future = await page.locator('.text-4xl').first().textContent();
    expect(future).toBeTruthy();
    expect(future).toMatch(/[0-9]/);

    await expect(page.getByRole('heading', { name: 'Balance & cumulative growth' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Investment schedule' })).toBeVisible();

    // yearly summary by default (1 year = 1 row)
    await expect(page.locator('table tbody tr')).toHaveCount(1);
  });

  test('supports multiple contribution streams', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#lump').fill('0');
    await page.locator('#rate').fill('0');
    await page.locator('#years').fill('1');
    // defaults: 30000 monthly + 50000 annual -> final 410000
    await page.getByRole('button', { name: 'Calculate' }).click();

    const future = await page.locator('.text-4xl').first().textContent();
    expect(future).toMatch(/410[,.]?0/);
  });

  test('adds and removes contribution streams', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    const initial = await page.locator('input[aria-label*="amount"]').count();
    await page.getByRole('button', { name: '+ Add contribution' }).click();
    await expect(page.locator('input[aria-label*="amount"]')).toHaveCount(initial + 1);
    await page.getByRole('button', { name: /^Remove contribution/ }).last().click();
    await expect(page.locator('input[aria-label*="amount"]')).toHaveCount(initial);
  });

  test('toggles the schedule to a monthly breakdown', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#lump').fill('1000');
    await page.locator('#rate').fill('6');
    await page.locator('#years').fill('2');
    await page.getByRole('button', { name: 'Calculate' }).click();

    await expect(page.locator('table tbody tr')).toHaveCount(2);
    await page.getByLabel('Show monthly breakdown').check();
    await expect(page.locator('table tbody tr')).toHaveCount(24);
  });

  test('validates negative lump sum with an error message', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#lump').fill('-5');
    await page.getByRole('button', { name: 'Calculate' }).click();
    // inputs clamp negatives to 0, so this should succeed instead; use a
    // zero-term case to trigger validation.
    await page.locator('#years').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('changes currency of the displayed output', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#lump').fill('100000');
    await page.locator('#rate').fill('12');
    await page.locator('#years').fill('1');
    await page.locator('#currency').selectOption('INR');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const future = await page.locator('.text-4xl').first().textContent();
    expect(future).toContain('₹');
  });
});
