import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const URL = '/tools/dev/tcpdump-converter';

const SAMPLE_HEX =
  'aabbccddeeff 112233445566 0800 4500003c0001000040060000 0a000001 0a000002 01bb138800000001000000005002200000000000';

test.describe('Tcpdump to Scapy Converter', () => {
  test('converts plain hex to Scapy Python code', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill(SAMPLE_HEX);
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('from scapy.all import');
    expect(out).toContain('Ether(');
    expect(out).toContain('IP(');
    expect(out).toContain('TCP(');
    expect(out).toContain("src='10.0.0.1'");
  });

  test('switches to hex output', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill(SAMPLE_HEX);
    await page.locator('#kind').selectOption('hex');
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('# packet 0');
    expect(out).toMatch(/^[0-9a-f]+$/m);
  });

  test('switches to raw bytes python output', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill('41 42 43');
    await page.locator('#kind').selectOption('pybytes');
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain("pkt0 = b'ABC'");
  });

  test('loads the sample and shows packet count', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('text=/Parsed \\d+ packet/')).toBeVisible();
  });

  test('shows an error when no hex is present', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill('just some words, no bytes');
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('.text-red-700, [class*="text-red"]')).toBeVisible();
  });

  test('parses multiple packets into a list', async ({ page }) => {
    await gotoReady(page, URL);
    const input = [
      '12:00:00.000001 IP 1.2.3.4 > 5.6.7.8: tcp',
      '  0x0000: 0011 2233',
      '12:00:00.000002 IP 9.9.9.9 > 8.8.8.8: tcp',
      '  0x0010: 4455 6677',
    ].join('\n');
    await page.locator('textarea').first().fill(input);
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('packets = [pkt0, pkt1]');
  });
});
