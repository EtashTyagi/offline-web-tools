import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const URL = '/tools/dev/pcap-analyzer';

test.describe('PCAP Analyzer', () => {
  test('loads the sample and shows stats and packets', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    // Stat cards
    await expect(page.getByText('Packets').first()).toBeVisible();
    await expect(page.locator('text=/^\\d+$/').first()).toBeVisible();
    // Packet table header
    await expect(page.getByRole('heading', { name: /Packets \(\d+\)/ })).toBeVisible();
    // At least one table row.
    await expect(page.locator('tbody tr').first()).toBeVisible();
  });

  test('decodes a TCP packet in the table', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    // The first sample packet is a TCP SYN to :443 (https).
    await expect(page.locator('tbody tr').first()).toContainText('TCP');
    await expect(page.locator('tbody tr').first()).toContainText('443');
  });

  test('inspects a packet to show its layers', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    await page.locator('tbody tr').first().click();
    await expect(page.getByRole('heading', { name: /Packet #0 detail/ })).toBeVisible();
    // Layer detail renders unique offset/length labels per layer.
    await expect(page.getByText('offset 0, length 14')).toBeVisible();
    await expect(page.getByText('offset 14, length 20')).toBeVisible();
    await expect(page.getByText('offset 34, length 20')).toBeVisible();
  });

  test('toggles layer fields visibility', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    await page.locator('tbody tr').first().click();
    // Fields hidden by default.
    expect(await page.getByText('ihl:').count()).toBe(0);
    await page.getByLabel('Show layer fields').check();
    await expect(page.getByText('ihl:')).toBeVisible();
  });

  test('filters packets by the search box', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    // Matching filter keeps rows present.
    await page.getByPlaceholder('Filter by IP, port, or info…').fill('10.0.0.2');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    // Non-matching filter clears the table.
    await page.getByPlaceholder('Filter by IP, port, or info…').fill('zzzznomatch');
    await expect(page.locator('tbody tr')).toHaveCount(0);
  });

  test('selects a conversation and shows its packet flow', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    // Click the first conversation button.
    const convBtn = page.locator('text=/10\\.0\\.0\\.1 → 10\\.0\\.0\\.2/').first();
    await convBtn.click();
    await expect(page.getByRole('heading', { name: /Packet flow/ })).toBeVisible();
    // Flow list has at least one inspect button.
    await expect(page.getByRole('button', { name: 'inspect' }).first()).toBeVisible();
  });

  test('renders the topology graph with nodes', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    await expect(page.locator('svg[aria-label="Network topology graph"]')).toBeVisible();
    await expect(page.locator('svg[aria-label="Network topology graph"] circle').first()).toBeVisible();
  });

  test('shows an ARP packet among the sample', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Load sample' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: 'ARP' })).toHaveCount(1);
  });
});
