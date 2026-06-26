import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/spain-income-tax-calculator';

test.describe('Spain IRPF Calculator', () => {
  test('computes IRPF with bands and the personal minimum', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('30000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/€/);
    expect(total).toMatch(/[0-9]/);
    await expect(page.getByRole('heading', { name: 'Tax by band' })).toBeVisible();
  });

  test('subtracts deductible expenses', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('50000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const before = await page.locator('article .text-4xl').first().textContent();

    await page.locator('#expenses').fill('5000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const after = await page.locator('article .text-4xl').first().textContent();

    expect(after).not.toEqual(before);
  });

  test('applies the 47% top bracket for high income', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('400000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByText('47%')).toBeVisible();
  });

  test('shows an error when income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
