import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/india-income-tax-calculator';

test.describe('India Income Tax Calculator', () => {
  test('recommends a regime and shows the comparison chart', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('1200000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const rec = await page.locator('article .text-3xl').first().textContent();
    expect(rec).toMatch(/Regime/);
    await expect(page.getByRole('heading', { name: 'New vs Old regime' })).toBeVisible();
  });

  test('shows both regime breakdowns', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('1500000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    await expect(page.getByRole('heading', { name: 'New Regime breakdown' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Old Regime breakdown' })).toBeVisible();
    // total tax payable appears twice (once per regime)
    await expect(page.getByText('Total tax payable')).toHaveCount(2);
  });

  test('recommends the old regime once deductions make it cheaper', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('2000000');
    await page.locator('#d80c').fill('150000');
    await page.locator('#d80d').fill('25000');
    await page.locator('#dnps').fill('50000');
    await page.locator('#dhra').fill('200000');
    await page.locator('#dhome').fill('200000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const rec = await page.locator('article .text-3xl').first().textContent();
    expect(rec).toContain('Old Regime');
  });

  test('charges no tax on income within the 87A rebate band', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('500000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    // both regime totals should be 0 (formatted as ₹0)
    await expect(page.getByText('New regime tax').locator('..').locator('p').last()).toContainText('₹0');
    await expect(page.getByText('Old regime tax').locator('..').locator('p').last()).toContainText('₹0');
  });

  test('shows an error when income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#gross').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
