import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/france-income-tax-calculator';

test.describe('France Income Tax Calculator', () => {
  test('computes IR with the 10% abatement and bands', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#salaried').fill('40000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/€/);
    expect(total).toMatch(/[0-9]/);
    await expect(page.getByRole('heading', { name: 'Tax by band' })).toBeVisible();
  });

  test('reduces tax with more quotient familial parts (children)', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#salaried').fill('100000');
    await page.locator('#hh').selectOption('couple');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const couple = await page.locator('article .text-4xl').first().textContent();

    await page.locator('#hh').selectOption('couple2');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const couple2 = await page.locator('article .text-4xl').first().textContent();

    expect(couple2).not.toEqual(couple);
  });

  test('toggles the 10% frais professionnels deduction', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#salaried').fill('40000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const withAbat = await page.locator('article .text-4xl').first().textContent();

    await page.getByLabel('Apply 10% frais professionnels deduction').uncheck();
    await page.getByRole('button', { name: 'Calculate' }).click();
    const withoutAbat = await page.locator('article .text-4xl').first().textContent();

    expect(withAbat).not.toEqual(withoutAbat);
  });

  test('shows an error when income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#salaried').fill('0');
    await page.locator('#other').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
