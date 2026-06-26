import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/financial/italy-income-tax-calculator';

test.describe('Italy IRPEF Calculator', () => {
  test('computes national IRPEF plus surtaxes', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('50000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const total = await page.locator('article .text-4xl').first().textContent();
    expect(total).toMatch(/€/);
    expect(total).toMatch(/[0-9]/);
    await expect(page.getByRole('heading', { name: 'Tax by band' })).toBeVisible();
    // breakdown lists the three components
    await expect(page.getByText('National IRPEF').first()).toBeVisible();
    await expect(page.getByText('Addizionale regionale').first()).toBeVisible();
  });

  test('applies the 43% top bracket above €50,000', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('80000');
    await page.getByRole('button', { name: 'Calculate' }).click();
    // the band table shows the 43% scaglione
    await expect(page.locator('table').getByText('43%')).toBeVisible();
  });

  test('lets the user change regional and municipal surtax rates', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('60000');
    await page.locator('#regional').fill('3.33');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const high = await page.locator('article .text-4xl').first().textContent();

    await page.locator('#regional').fill('1.23');
    await page.getByRole('button', { name: 'Calculate' }).click();
    const low = await page.locator('article .text-4xl').first().textContent();

    expect(high).not.toEqual(low);
  });

  test('shows an error when income is zero', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#income').fill('0');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
