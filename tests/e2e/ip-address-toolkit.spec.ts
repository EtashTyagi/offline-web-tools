import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const HUB_URL = '/tools/dev/ip-address-toolkit';

const SUB_TOOLS = [
  '/tools/dev/ip-inspector',
  '/tools/dev/ip-subnet-membership',
  '/tools/dev/subnet-planner',
  '/tools/dev/ip-converter',
  '/tools/dev/ip-batch-validator',
  '/tools/dev/ip-special-ranges',
];

test.describe('IP Address Toolkit hub', () => {
  test('renders hub and links to every sub-tool', async ({ page }) => {
    await gotoReady(page, HUB_URL);
    await expect(page.getByRole('heading', { name: 'IP Address Toolkit', level: 1 })).toBeVisible();
    for (const path of SUB_TOOLS) {
      await expect(page.locator(`a[href="${path}"]`).first()).toBeVisible();
    }
  });

  test('navigates from hub to IP Inspector', async ({ page }) => {
    await gotoReady(page, HUB_URL);
    await page.locator('a[href="/tools/dev/ip-inspector"]').first().click();
    await expect(page).toHaveURL(/\/tools\/dev\/ip-inspector/);
    await expect(page.getByRole('heading', { name: 'IP Inspector', level: 1 })).toBeVisible();
  });
});

test.describe('IP Inspector', () => {
  test('inspects an IPv4 CIDR and shows subnet fields', async ({ page }) => {
    await gotoReady(page, '/tools/dev/ip-inspector');
    await page.locator('#inspect-input').fill('192.168.1.10/24');
    await page.locator('#inspect-run').click();
    await expect(page.getByText('192.168.1.0/24').first()).toBeVisible();
    await expect(page.getByText('255.255.255.0').first()).toBeVisible();
    await expect(page.getByText(/private/i).first()).toBeVisible();
  });

  test('shows validation error for bad inspect input', async ({ page }) => {
    await gotoReady(page, '/tools/dev/ip-inspector');
    await page.locator('#inspect-input').fill('999.999.999.999');
    await page.locator('#inspect-run').click();
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});

test.describe('Subnet Membership', () => {
  test('checks IP membership in a subnet', async ({ page }) => {
    await gotoReady(page, '/tools/dev/ip-subnet-membership');
    await page.locator('#contain-ip').fill('10.0.5.20');
    await page.locator('#contain-cidr').fill('10.0.0.0/16');
    await page.getByRole('button', { name: 'Check membership' }).click();
    await expect(page.getByText(/is inside/i)).toBeVisible();
  });
});

test.describe('Subnet Planner', () => {
  test('splits a subnet', async ({ page }) => {
    await gotoReady(page, '/tools/dev/subnet-planner');
    await page.getByRole('tab', { name: 'Split subnet' }).click();
    await page.locator('#plan-cidr').fill('192.168.0.0/24');
    await page.locator('#plan-new-prefix').fill('26');
    await page.getByRole('button', { name: 'Run' }).click();
    const out = page.getByLabel('Plan output');
    await expect(out).toBeVisible();
    const text = await out.inputValue();
    expect(text).toContain('192.168.0.0/26');
    expect(text).toContain('192.168.0.192/26');
  });
});

test.describe('IP Converter', () => {
  test('converts IPv4 to mapped IPv6', async ({ page }) => {
    await gotoReady(page, '/tools/dev/ip-converter');
    await page.locator('#conv-v4').fill('192.0.2.10');
    await page.getByRole('button', { name: 'IPv4 → ::ffff:…' }).click();
    await expect(page.getByText(/::ffff:/i).first()).toBeVisible();
  });
});

test.describe('IP Batch Validator', () => {
  test('batch processes a list with invalid line', async ({ page }) => {
    await gotoReady(page, '/tools/dev/ip-batch-validator');
    await page.locator('#batch-input').fill('8.8.8.8\nnot-an-ip\n10.1.1.1');
    await page.locator('#batch-cidr').fill('10.0.0.0/8');
    await page.getByRole('button', { name: 'Process batch' }).click();
    await expect(page.getByText('2/3 valid')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'not-an-ip', exact: true })).toBeVisible();
  });
});

test.describe('IP Special Ranges', () => {
  test('shows special ranges and external links', async ({ page }) => {
    await gotoReady(page, '/tools/dev/ip-special-ranges');
    await expect(page.getByText('10.0.0.0/8').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /WHOIS lookup/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /IP geolocation/i })).toBeVisible();
  });
});
