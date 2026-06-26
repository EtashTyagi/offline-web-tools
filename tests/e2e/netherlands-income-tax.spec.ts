import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/netherlands-income-tax-calculator';

test.describe('Netherlands Income Tax Calculator', () => {
  test('computes Box 1 tax after heffingskortingen', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('50000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/€/);
    expect(total).toMatch(/[0-9]/);
    await expect(page.getByRole('heading', { name: 'Tax by band' })).toBeVisible();
  });

  test('applies the 49.5% top bracket above €76,817', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('100000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByText('49.5%')).toBeVisible();
  });

  test('shows the heffingskorting credits', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('40000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByText('Total heffingskorting')).toBeVisible();
  });

  test('shows an error when income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
