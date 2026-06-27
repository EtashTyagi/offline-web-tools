import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const URL = '/tools/dev/json-formatter';

function inputArea(page: import('@playwright/test').Page) {
  return page.locator('textarea[aria-label="JSON input"]');
}

function outputArea(page: import('@playwright/test').Page) {
  return page.locator('textarea[aria-label="JSON output"]');
}

test.describe('JSON Formatter', () => {
  test('formats JSON with 2-space indent (default)', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1,"b":[1,2]}');
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  });

  test('minifies JSON', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'minify' }).click();
    await inputArea(page).fill('{\n  "a": 1,\n  "b": [2,3]\n}');
    await page.getByRole('button', { name: 'Minify JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toBe('{"a":1,"b":[2,3]}');
    expect(out.includes('\n')).toBe(false);
  });

  test('validate mode reports success for valid JSON', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'validate' }).click();
    await inputArea(page).fill('{"ok":true}');
    await page.getByRole('button', { name: 'Validate JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toContain('valid');
  });

  test('validate mode reports error with line and column', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'validate' }).click();
    await inputArea(page).fill('{\n  "a": 1,\n  "b":\n}');
    await page.getByRole('button', { name: 'Validate JSON' }).click();
    await expect(page.locator('[class*="text-red"]').first()).toBeVisible();
    await expect(page.locator('[class*="text-red"]').first()).toContainText('Invalid JSON');
  });

  test('switching to 4-space indent re-formats', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1}');
    await page.locator('#indent-preset').selectOption('s4');
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toBe('{\n    "a": 1\n}');
  });

  test('tab indent works', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1}');
    await page.locator('#indent-preset').selectOption('tab');
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toBe('{\n\t"a": 1\n}');
  });

  test('custom indent (3 spaces)', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1}');
    await page.locator('#indent-preset').selectOption('custom');
    const indentInput = page.getByLabel('Custom indent width');
    await indentInput.fill('3');
    await indentInput.blur();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toBe('{\n   "a": 1\n}');
  });

  test('sort keys alphabetically', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"b":2,"a":1,"c":{"y":1,"x":2}}');
    await page.getByLabel('Sort keys alphabetically').check();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out.indexOf('"a"')).toBeLessThan(out.indexOf('"b"'));
    expect(out.indexOf('"x"')).toBeLessThan(out.indexOf('"y"'));
  });

  test('drop null values', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1,"b":null,"c":3}');
    await page.getByLabel('Drop null values').check();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).not.toContain('"b"');
    expect(out).toContain('"a": 1');
    expect(out).toContain('"c": 3');
  });

  test('escape non-ASCII', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"name":"café"}');
    await page.getByLabel('Escape non-ASCII').check();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toContain('caf\\u00e9');
    expect(out).not.toContain('café');
  });

  test('sample button loads example JSON', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    const v = await inputArea(page).inputValue();
    expect(v).toContain('Ada Lovelace');
  });

  test('clear button empties input and output', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1}');
    await page.getByRole('button', { name: 'Format JSON' }).click();
    await expect(outputArea(page)).not.toHaveValue('');
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(inputArea(page)).toHaveValue('');
    await expect(outputArea(page)).toHaveValue('');
  });

  test('copy button copies output', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1}');
    await page.getByRole('button', { name: 'Format JSON' }).click();
    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  });

  test('loads JSON from file', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'file' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'in.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"from":"file","n":7}'),
    });
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = await outputArea(page).inputValue();
    expect(out).toContain('"from": "file"');
    expect(out).toContain('"n": 7');
  });

  test('switching to minify hides format-only options', async ({ page }) => {
    await gotoReady(page, URL);
    await expect(page.locator('#indent-preset')).toBeVisible();
    await page.getByRole('button', { name: 'minify' }).click();
    await expect(page.locator('#indent-preset')).toHaveCount(0);
  });

  test('renders stats panel after formatting', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1,"b":{"c":[1,2,3]}}');
    await page.getByRole('button', { name: 'Format JSON' }).click();
    await expect(page.getByText('Keys', { exact: true })).toBeVisible();
    await expect(page.getByText('Max depth', { exact: true })).toBeVisible();
    await expect(page.getByText('Input bytes', { exact: true })).toBeVisible();
    await expect(page.getByText('Output bytes', { exact: true })).toBeVisible();
  });

  test('minify produces shorter output than pretty', async ({ page }) => {
    await gotoReady(page, URL);
    const text = '{"a":1,"b":[1,2,3],"c":{"d":true}}';
    await inputArea(page).fill(text);
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const pretty = await outputArea(page).inputValue();
    await page.getByRole('button', { name: 'minify' }).click();
    await page.getByRole('button', { name: 'Minify JSON' }).click();
    const mini = await outputArea(page).inputValue();
    expect(mini.length).toBeLessThan(pretty.length);
  });

  test('color syntax is off by default (plain textarea)', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1}');
    await page.getByRole('button', { name: 'Format JSON' }).click();
    await expect(outputArea(page)).toBeVisible();
    await expect(page.getByLabel('JSON output').locator('pre')).toHaveCount(0);
  });

  test('color syntax toggle renders colored tokens in a pre block', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"name":"x","n":3,"ok":true,"z":null}');
    await page.getByLabel('Color syntax in output').check();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = page.locator('pre[aria-label="JSON output"]');
    await expect(out).toBeVisible();
    await expect(out.locator('span').filter({ hasText: '"name"' })).toHaveCount(1);
    await expect(out.locator('span').filter({ hasText: '"x"' }).first()).toBeVisible();
    await expect(out.locator('span').filter({ hasText: '3' }).first()).toBeVisible();
    await expect(out.locator('span').filter({ hasText: 'true' }).first()).toBeVisible();
    await expect(out.locator('span').filter({ hasText: 'null' }).first()).toBeVisible();
  });

  test('toggling color syntax off returns to plain textarea', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":1}');
    await page.getByLabel('Color syntax in output').check();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    await expect(page.locator('pre[aria-label="JSON output"]')).toBeVisible();
    await page.getByLabel('Color syntax in output').uncheck();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    await expect(outputArea(page)).toBeVisible();
  });

  test('color syntax shows different classes for each token type', async ({ page }) => {
    await gotoReady(page, URL);
    await inputArea(page).fill('{"a":"s","n":1,"b":true,"z":null}');
    await page.getByLabel('Color syntax in output').check();
    await page.getByRole('button', { name: 'Format JSON' }).click();
    const out = page.locator('pre[aria-label="JSON output"]');
    await expect(out).toBeVisible();
    const keySpans = out.locator('span').filter({ hasText: '"a"' });
    const strSpans = out.locator('span').filter({ hasText: '"s"' });
    const numSpans = out.locator('span').filter({ hasText: '1' });
    const boolSpans = out.locator('span').filter({ hasText: 'true' });
    const nullSpans = out.locator('span').filter({ hasText: 'null' });
    await expect(keySpans).toHaveCount(1);
    await expect(strSpans.first()).toBeVisible();
    await expect(numSpans.first()).toBeVisible();
    await expect(boolSpans.first()).toBeVisible();
    await expect(nullSpans.first()).toBeVisible();
  });
});