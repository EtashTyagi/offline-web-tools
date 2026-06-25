import { describe, it, expect } from 'vitest';
import {
  OUTPUT_FORMATS,
  getOutputFormat,
  detectFormat,
  clampQuality,
  computeResize,
  swapExtension,
  parseHexColor,
  formatBytes,
  sizeDelta,
} from '../../src/tools/files/image-format-converter/convert';

/* -------------------------------------------------------------- */
/* Output format registry                                         */
/* -------------------------------------------------------------- */

describe('OUTPUT_FORMATS', () => {
  it('lists png, jpeg, webp', () => {
    expect(OUTPUT_FORMATS.map((f) => f.id)).toEqual(['png', 'jpeg', 'webp']);
  });

  it('marks transparency correctly', () => {
    expect(getOutputFormat('png')?.hasAlpha).toBe(true);
    expect(getOutputFormat('webp')?.hasAlpha).toBe(true);
    expect(getOutputFormat('jpeg')?.hasAlpha).toBe(false);
  });

  it('marks quality applicability', () => {
    expect(getOutputFormat('png')?.qualityApplies).toBe(false);
    expect(getOutputFormat('jpeg')?.qualityApplies).toBe(true);
    expect(getOutputFormat('webp')?.qualityApplies).toBe(true);
  });

  it('uses correct extensions', () => {
    expect(getOutputFormat('jpeg')?.ext).toBe('jpg');
    expect(getOutputFormat('png')?.ext).toBe('png');
    expect(getOutputFormat('webp')?.ext).toBe('webp');
  });

  it('returns undefined for unknown formats', () => {
    expect(getOutputFormat('tiff')).toBeUndefined();
  });
});

/* -------------------------------------------------------------- */
/* detectFormat (magic numbers)                                   */
/* -------------------------------------------------------------- */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
const GIF89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const BMP = new Uint8Array([0x42, 0x4d, 0x00, 0x00]);
const ICO = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const AVIF = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
const HEIC = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const MIF1 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31]);

describe('detectFormat', () => {
  it('detects PNG', () => {
    expect(detectFormat(PNG)).toBe('png');
  });
  it('detects JPEG', () => {
    expect(detectFormat(JPEG)).toBe('jpeg');
  });
  it('detects GIF87a and GIF89a', () => {
    expect(detectFormat(GIF87)).toBe('gif');
    expect(detectFormat(GIF89)).toBe('gif');
  });
  it('detects BMP', () => {
    expect(detectFormat(BMP)).toBe('bmp');
  });
  it('detects ICO', () => {
    expect(detectFormat(ICO)).toBe('ico');
  });
  it('detects WebP (RIFF....WEBP)', () => {
    expect(detectFormat(WEBP)).toBe('webp');
  });
  it('detects AVIF (ftypavif)', () => {
    expect(detectFormat(AVIF)).toBe('avif');
  });
  it('detects HEIC (ftypheic)', () => {
    expect(detectFormat(HEIC)).toBe('heic');
  });
  it('detects HEIC variant mif1', () => {
    expect(detectFormat(MIF1)).toBe('heic');
  });
  it('detects SVG by leading xml declaration', () => {
    expect(detectFormat(new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('svg');
  });
  it('detects SVG by leading <svg', () => {
    expect(detectFormat(new TextEncoder().encode('<svg width="10" height="10"></svg>'))).toBe('svg');
  });
  it('returns unknown for arbitrary bytes', () => {
    expect(detectFormat(new Uint8Array([0x01, 0x02, 0x03]))).toBe('unknown');
  });
  it('returns unknown for empty input', () => {
    expect(detectFormat(new Uint8Array())).toBe('unknown');
  });
  it('does not misclassify a short RIFF as WebP', () => {
    expect(detectFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe('unknown');
  });
});

/* -------------------------------------------------------------- */
/* clampQuality                                                   */
/* -------------------------------------------------------------- */

describe('clampQuality', () => {
  it('converts a percentage to a 0..1 fraction', () => {
    expect(clampQuality(50)).toBeCloseTo(0.5);
    expect(clampQuality(100)).toBe(1);
  });
  it('clamps below 0 and above 100', () => {
    expect(clampQuality(-10)).toBe(0);
    expect(clampQuality(200)).toBe(1);
  });
  it('falls back to a default for NaN', () => {
    expect(clampQuality(NaN)).toBeCloseTo(0.92);
  });
});

/* -------------------------------------------------------------- */
/* computeResize                                                  */
/* -------------------------------------------------------------- */

describe('computeResize', () => {
  it('returns original dimensions for none', () => {
    expect(computeResize(800, 600, { mode: 'none', value: 0 })).toEqual({ width: 800, height: 600 });
  });
  it('scales by width keeping aspect', () => {
    expect(computeResize(800, 600, { mode: 'width', value: 400 })).toEqual({ width: 400, height: 300 });
  });
  it('scales by height keeping aspect', () => {
    expect(computeResize(800, 600, { mode: 'height', value: 300 })).toEqual({ width: 400, height: 300 });
  });
  it('scales by percentage', () => {
    expect(computeResize(1000, 500, { mode: 'percent', value: 50 })).toEqual({ width: 500, height: 250 });
    expect(computeResize(1000, 500, { mode: 'percent', value: 200 })).toEqual({ width: 2000, height: 1000 });
  });
  it('fits within max side (landscape)', () => {
    // 800x600, cap 300 -> scale 300/800 -> 300x225
    expect(computeResize(800, 600, { mode: 'max', value: 300 })).toEqual({ width: 300, height: 225 });
  });
  it('fits within max side (portrait)', () => {
    // 600x800, cap 300 -> scale 300/800 -> 225x300
    expect(computeResize(600, 800, { mode: 'max', value: 300 })).toEqual({ width: 225, height: 300 });
  });
  it('handles square input with max', () => {
    expect(computeResize(400, 400, { mode: 'max', value: 200 })).toEqual({ width: 200, height: 200 });
  });
  it('returns original for zero/negative dimensions', () => {
    expect(computeResize(0, 0, { mode: 'width', value: 100 })).toEqual({ width: 0, height: 0 });
    expect(computeResize(-5, 10, { mode: 'width', value: 100 })).toEqual({ width: -5, height: 10 });
  });
  it('clamps tiny width values to at least 1', () => {
    expect(computeResize(800, 600, { mode: 'width', value: 0 })).toEqual({ width: 1, height: 1 });
  });
});

/* -------------------------------------------------------------- */
/* swapExtension                                                  */
/* -------------------------------------------------------------- */

describe('swapExtension', () => {
  it('replaces the extension', () => {
    expect(swapExtension('photo.PNG', 'jpg')).toBe('photo.jpg');
    expect(swapExtension('a/b/c.webp', 'png')).toBe('a/b/c.png');
  });
  it('appends an extension when none exists', () => {
    expect(swapExtension('noext', 'webp')).toBe('noext.webp');
  });
  it('handles dotted directory names', () => {
    expect(swapExtension('my.folder/file.jpeg', 'png')).toBe('my.folder/file.png');
  });
});

/* -------------------------------------------------------------- */
/* parseHexColor                                                  */
/* -------------------------------------------------------------- */

describe('parseHexColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseHexColor('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('parses without leading hash', () => {
    expect(parseHexColor('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });
  it('parses 3-digit shorthand', () => {
    expect(parseHexColor('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('returns null for invalid input', () => {
    expect(parseHexColor('#xyz')).toBeNull();
    expect(parseHexColor('12345')).toBeNull();
    expect(parseHexColor('')).toBeNull();
  });
});

/* -------------------------------------------------------------- */
/* formatBytes + sizeDelta                                        */
/* -------------------------------------------------------------- */

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });
  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024 * 2)).toBe('2.00 MB');
  });
});

describe('sizeDelta', () => {
  it('computes negative delta when smaller', () => {
    expect(sizeDelta(1000, 500)).toBe(-50);
  });
  it('computes positive delta when larger', () => {
    expect(sizeDelta(500, 1000)).toBe(100);
  });
  it('returns 0 when original is 0', () => {
    expect(sizeDelta(0, 500)).toBe(0);
  });
});
