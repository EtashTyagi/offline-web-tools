import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/us-income-tax-calculator';

test.describe('US Income Tax Calculator', () => {
  test('computes total tax, effective rate, and shows breakdown', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#wages').fill('80000');
    await page.locator('#se').fill('0');
    await page.locator('#other').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const total = await page.locator('.text-4xl').first().textContent();
    expect(total).toMatch(/\$/);
    expect(total).toMatch(/[0-9]/);

    await expect(page.getByRole('heading', { name: 'Tax by bracket' })).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    // single 80k wages span 3 brackets (10/12/22%)
    await expect(page.locator('table tbody tr')).toHaveCount(7);
  });

  test('switches filing status', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#wages').fill('200000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const singleTotal = await page.locator('.text-4xl').first().textContent();

    await page.locator('#status').selectOption('mfj');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const mfjTotal = await page.locator('.text-4xl').first().textContent();

    expect(singleTotal).not.toEqual(mfjTotal);
  });

  test('handles self-employment income and shows SE tax', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#wages').fill('0');
    await page.locator('#se').fill('100000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    // breakdown table lists self-employment tax
    await expect(page.locator('table').getByText('Self-employment tax')).toBeVisible();
  });

  test('toggles to itemized deduction', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.getByLabel('Itemized').check();
    await expect(page.locator('#itemized')).toBeVisible();
    await page.locator('#itemized').fill('25000');
    await page.locator('#wages').fill('80000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const total = await page.locator('.text-4xl').first().textContent();
    expect(total).toMatch(/\$/);
  });

  test('shows an error when all income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#wages').fill('0');
    await page.locator('#se').fill('0');
    await page.locator('#other').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
