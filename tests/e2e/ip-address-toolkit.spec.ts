import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const TOOL_URL = '/tools/dev/ip-address-toolkit';

test.describe('IP Address Toolkit', () => {
  test('inspects an IPv4 CIDR and shows subnet fields', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#inspect-input').fill('192.168.1.10/24');
    await page.locator('#inspect-run').click();
    await expect(page.getByText('192.168.1.0/24').first()).toBeVisible();
    await expect(page.getByText('255.255.255.0').first()).toBeVisible();
    await expect(page.getByText(/private/i).first()).toBeVisible();
  });

  test('checks IP membership in a subnet', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.getByRole('tab', { name: 'Containment' }).click();
    await page.locator('#contain-ip').fill('10.0.5.20');
    await page.locator('#contain-cidr').fill('10.0.0.0/16');
    await page.getByRole('button', { name: 'Check membership' }).click();
    await expect(page.getByText(/is inside/i)).toBeVisible();
  });

  test('splits a subnet in Plan', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.getByRole('tab', { name: 'Plan' }).click();
    await page.getByRole('button', { name: 'Split subnet' }).click();
    await page.locator('#plan-cidr').fill('192.168.0.0/24');
    await page.locator('#plan-new-prefix').fill('26');
    await page.getByRole('button', { name: 'Run' }).click();
    const out = page.getByLabel('Plan output');
    await expect(out).toBeVisible();
    const text = await out.inputValue();
    expect(text).toContain('192.168.0.0/26');
    expect(text).toContain('192.168.0.192/26');
  });

  test('converts IPv4 to mapped IPv6', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.getByRole('tab', { name: 'Convert' }).click();
    await page.locator('#conv-v4').fill('192.0.2.10');
    await page.getByRole('button', { name: 'IPv4 → ::ffff:…' }).click();
    await expect(page.getByText(/::ffff:/i).first()).toBeVisible();
  });

  test('batch processes a list with invalid line', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.getByRole('tab', { name: 'Batch' }).click();
    await page.locator('#batch-input').fill('8.8.8.8\nnot-an-ip\n10.1.1.1');
    await page.locator('#batch-cidr').fill('10.0.0.0/8');
    await page.getByRole('button', { name: 'Process batch' }).click();
    await expect(page.getByText('2/3 valid')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'not-an-ip', exact: true })).toBeVisible();
  });

  test('shows special ranges and external links', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.getByRole('tab', { name: 'Ranges & links' }).click();
    await expect(page.getByText('10.0.0.0/8').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'WHOIS lookup' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'IP geolocation' })).toBeVisible();
  });

  test('shows validation error for bad inspect input', async ({ page }) => {
    await gotoReady(page, TOOL_URL);
    await page.locator('#inspect-input').fill('999.999.999.999');
    await page.locator('#inspect-run').click();
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
