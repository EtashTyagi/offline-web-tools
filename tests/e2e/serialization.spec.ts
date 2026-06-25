import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const CONV_URL = '/tools/dev/serialization-converter';

async function convert(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /^Convert/ }).click();
}

async function output(page: import('@playwright/test').Page) {
  return page.locator('textarea[readonly]').inputValue();
}

test.describe('Serialization Converter', () => {
  test('converts BSON to JSON using the sample data', async ({ page }) => {
    await gotoReady(page, CONV_URL);
    // default From=BSON, To=JSON, paste, base64
    await page.getByRole('button', { name: 'Sample' }).click();
    await convert(page);
    const out = await output(page);
    expect(out).toContain('"msg": "hi"');
    expect(out).toContain('"n": 7');
    expect(out).toContain('"list"');
  });

  test('converts Protobuf (hex) to JSON', async ({ page }) => {
    await gotoReady(page, CONV_URL);
    await page.locator('#src').selectOption('protobuf');
    await page.locator('#enc').selectOption('hex');
    await page.locator('textarea').first().fill('089601 1207 74657374696e67');
    await convert(page);
    const out = await output(page);
    expect(out).toContain('150');
    expect(out).toContain('testing');
  });

  test('converts JSON to BSON (any-to-any, encode direction)', async ({ page }) => {
    await gotoReady(page, CONV_URL);
    await page.locator('#src').selectOption('json');
    await page.locator('#tgt').selectOption('bson');
    await page.locator('textarea').first().fill('{"a":1,"b":[2,3]}');
    await convert(page);
    const out = await output(page);
    expect(out).toContain('Base64');
    expect(out).toContain('Hex');
    // base64 of a BSON doc is non-empty
    expect(out.replace(/\/\/[^\n]*\n/g, '').trim().length).toBeGreaterThan(0);
  });

  test('swap button flips source and target', async ({ page }) => {
    await gotoReady(page, CONV_URL);
    await expect(page.locator('#src')).toHaveValue('bson');
    await expect(page.locator('#tgt')).toHaveValue('json');
    await page.getByRole('button', { name: /Swap source and target/ }).click();
    await expect(page.locator('#src')).toHaveValue('json');
    await expect(page.locator('#tgt')).toHaveValue('bson');
  });

  test('shows an error for invalid BSON input', async ({ page }) => {
    await gotoReady(page, CONV_URL);
    await page.locator('textarea').first().fill('not-valid-base64!!!');
    await convert(page);
    await expect(page.locator('.text-red-700, [class*="text-red"]')).toBeVisible();
  });

  test('converts from a file (JSON to MessagePack)', async ({ page }) => {
    await gotoReady(page, CONV_URL);
    await page.locator('#src').selectOption('json');
    await page.locator('#tgt').selectOption('msgpack');
    // switch to file input
    await page.getByRole('button', { name: 'File' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'in.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"k":"v","n":3}'),
    });
    await convert(page);
    const out = await output(page);
    expect(out).toContain('Base64');
    expect(out).toContain('Encoded');
  });

  test('decode-only source cannot become a target via swap', async ({ page }) => {
    await gotoReady(page, CONV_URL);
    await page.locator('#src').selectOption('java');
    // swap disabled because java is decode-only
    await expect(page.getByRole('button', { name: /Swap/ })).toBeDisabled();
  });
});
