import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

const URL = '/tools/dev/packet-format-converter';

const SAMPLE_HEX =
  'aabbccddeeff 112233445566 0800 4500003c0001000040060000 0a000001 0a000002 01bb138800000001000000005002200000000000';

const SAMPLE_SCAPY_STRING =
  '<Ether  dst=aa:bb:cc:dd:ee:ff src=11:22:33:44:55:66 type=IPv4 |<IP  version=4 ihl=5 tos=0x0 len=60 id=1 flags=010 frag=0 ttl=64 proto=tcp src=10.0.0.1 dst=10.0.0.2 |<TCP  sport=443 dport=5000 seq=1 ack=0 dataofs=5 flags=S window=8192 urgptr=0 |>>>';

test.describe('Network Packet Format Converter', () => {
  test('converts tcpdump hex to Scapy Python code', async ({ page }) => {
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

  test('converts hex input to Scapy code', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('#inFmt').selectOption('hex');
    await page.locator('textarea').first().fill(SAMPLE_HEX);
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('Ether(');
    expect(out).toContain('IP(');
  });

  test('switches output to hex format', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill(SAMPLE_HEX);
    await page.locator('#outFmt').selectOption('hex');
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toMatch(/^[0-9a-f]+$/m);
  });

  test('switches output to raw bytes format', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill('41 42 43');
    await page.locator('#inFmt').selectOption('hex');
    await page.locator('#outFmt').selectOption('raw-bytes');
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain("pkt0 = b'ABC'");
  });

  test('switches output to Scapy string format', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill(SAMPLE_HEX);
    await page.locator('#outFmt').selectOption('scapy-string');
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('<Ether');
    expect(out).toContain('dst=aa:bb:cc:dd:ee:ff');
    expect(out).toContain('<IP');
  });

  test('switches output to tcpdump format', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('textarea').first().fill(SAMPLE_HEX);
    await page.locator('#outFmt').selectOption('tcpdump');
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('0x0000:');
    expect(out).toContain('aabb');
  });

  test('converts Scapy string input to Scapy code', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('#inFmt').selectOption('scapy-string');
    await page.locator('textarea').first().fill(SAMPLE_SCAPY_STRING);
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('Ether(');
    expect(out).toContain('IP(');
    expect(out).toContain('TCP(');
  });

  test('converts Scapy code input to hex', async ({ page }) => {
    await gotoReady(page, URL);
    const scapyCode = "pkt0 = Ether(dst='aa:bb:cc:dd:ee:ff', src='11:22:33:44:55:66', type=0x0800) / IP(version=4, ihl=5, tos=0, len=20, id=0, flags=0, frag=0, ttl=64, proto=6, src='10.0.0.1', dst='10.0.0.2')";
    await page.locator('#inFmt').selectOption('scapy-code');
    await page.locator('#outFmt').selectOption('hex');
    await page.locator('textarea').first().fill(scapyCode);
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toMatch(/^[0-9a-f]+$/m);
    expect(out).toContain('aabbccddeeff');
  });

  test('converts raw bytes input to Scapy code', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('#inFmt').selectOption('raw-bytes');
    await page.locator('textarea').first().fill("b'\\xaa\\xbb\\xcc\\xdd\\xee\\xff\\x11\\x22\\x33\\x44\\x55\\x66\\x08\\x00'");
    await page.getByRole('button', { name: 'Convert' }).click();
    const out = await page.locator('textarea[readonly]').inputValue();
    expect(out).toContain('Ether(');
  });

  test('auto-detects tcpdump format', async ({ page }) => {
    await gotoReady(page, URL);
    const tcpdumpInput = [
      '12:00:00.000123 IP 10.0.0.1.443 > 10.0.0.2.5000: Flags [S],',
      '  0x0000:  aabb ccdd eeff 1122 3344 5566 0800 4500  ........"3Uf..E.',
      '  0x0010:  003c 0001 0000 4006 0000 0a00 0001 0a00  .<....@.........',
    ].join('\n');
    await page.locator('textarea').first().fill(tcpdumpInput);
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('text=/detected.*Tcpdump/i')).toBeVisible();
  });

  test('loads the sample and shows packet count', async ({ page }) => {
    await gotoReady(page, URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await page.getByRole('button', { name: 'Convert' }).click();
    await expect(page.locator('text=/Parsed \\d+ packet/')).toBeVisible();
  });

  test('shows an error when no valid data is present', async ({ page }) => {
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

  test('sample button loads format-specific sample', async ({ page }) => {
    await gotoReady(page, URL);
    await page.locator('#inFmt').selectOption('scapy-string');
    await page.getByRole('button', { name: 'Sample' }).click();
    const inputVal = await page.locator('textarea').first().inputValue();
    expect(inputVal).toContain('<Ether');
  });
});
