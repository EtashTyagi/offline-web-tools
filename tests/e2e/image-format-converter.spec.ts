import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const URL = '/tools/files/image-format-converter';

// A valid 1x1 transparent PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngBuffer = () => Buffer.from(PNG_B64, 'base64');

test.describe('Image Format Converter', () => {
  test('converts a PNG to WebP and shows a download button', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('input[type=file]').setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: pngBuffer(),
    });
    // default target is WebP in Chromium
    await expect(page.locator('#fmt')).toHaveValue('webp');
    await page.getByRole('button', { name: /Convert/ }).click();
    await expect(page.getByRole('button', { name: /Download test\.webp/i })).toBeVisible({ timeout: 10_000 });
    expect(page.getByText(/×50%\b|B|KB/)).toBeTruthy();
  });

  test('converts to JPEG and reveals the background color control', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('input[type=file]').setInputFiles({
      name: 'pic.png',
      mimeType: 'image/png',
      buffer: pngBuffer(),
    });
    await page.locator('#fmt').selectOption('jpeg');
    // JPEG has no transparency, so the background picker should appear.
    await expect(page.locator('#bg')).toBeVisible();
    await page.locator('#quality').fill('60');
    await page.getByRole('button', { name: /Convert/ }).click();
    await expect(page.getByRole('button', { name: /Download pic\.jpg/i })).toBeVisible({ timeout: 10_000 });
  });

  test('resizes by width and reports the new dimensions', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('input[type=file]').setInputFiles({
      name: 'px.png',
      mimeType: 'image/png',
      buffer: pngBuffer(),
    });
    await page.locator('#rmode').selectOption('width');
    await page.locator('#rval').fill('50');
    await page.getByRole('button', { name: /Convert/ }).click();
    // 1x1 source resized to width 50 -> 50x50
    await expect(page.getByText('50×50')).toBeVisible({ timeout: 10_000 });
  });

  test('shows an error for a corrupt image', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('input[type=file]').setInputFiles({
      name: 'broken.png',
      mimeType: 'image/png',
      buffer: Buffer.from('this is not a real png'),
    });
    await page.getByRole('button', { name: /Convert/ }).click();
    await expect(page.locator('[class*="text-red"]')).toBeVisible({ timeout: 10_000 });
  });

  test('batch converts multiple files', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('input[type=file]').setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: pngBuffer() },
      { name: 'b.png', mimeType: 'image/png', buffer: pngBuffer() },
    ]);
    await page.getByRole('button', { name: /Convert/ }).click();
    await expect(page.getByRole('button', { name: /Download a\.webp/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Download b\.webp/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Download all \(2\)/i })).toBeVisible();
  });
});
