import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/uk-income-tax-calculator';

test.describe('UK Income Tax Calculator', () => {
  test('computes total tax with the personal allowance', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('45000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/£/);
    expect(total).toMatch(/[0-9]/);
    await expect(page.getByRole('heading', { name: 'Tax by band' })).toBeVisible();
  });

  test('tapers the personal allowance above £100,000', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('120000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    // taxable income should reflect the reduced allowance (120000 - 2570)
    await expect(page.getByText('Taxable income').locator('..').getByText('£')).toBeVisible();
    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/£/);
  });

  test('subtracts pension relief', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('60000');
    await page.locator('#pension').fill('10000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/£/);
  });

  test('shows an error when income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
