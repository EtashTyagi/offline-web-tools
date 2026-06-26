import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/germany-income-tax-calculator';

test.describe('Germany Income Tax Calculator', () => {
  test('computes Einkommensteuer with bands', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('50000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/€/);
    expect(total).toMatch(/[0-9]/);
    await expect(page.getByRole('heading', { name: 'Tax by band' })).toBeVisible();
  });

  test('applies the Splittingverfahren for married filers', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('60000');
    await page.locator('#status').selectOption('married');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const married = await page.locator('article .text-4xl').first().textContent();

    await page.locator('#status').selectOption('single');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const single = await page.locator('article .text-4xl').first().textContent();

    expect(married).not.toEqual(single);
  });

  test('adds church tax when selected', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('100000');
    await page.locator('#church').selectOption('0.09');
    await page.getByRole('button', { name: 'Calculate' }).click();
    // breakdown table lists Kirchensteuer
    await expect(page.getByText('Kirchensteuer').first()).toBeVisible();
  });

  test('shows an error when income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
