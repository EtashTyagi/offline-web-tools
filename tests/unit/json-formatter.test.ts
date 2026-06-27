import { describe, it, expect } from 'vitest';
import {
  defaultOptions,
  formatJson,
  minifyJson,
  parseJson,
  posToLineColumn,
  tokensToText,
  type FormatOptions,
} from '../../src/tools/dev/json-formatter/formatter';

const BASE_OPTS: FormatOptions = defaultOptions();

function fmt(text: string, overrides: Partial<FormatOptions> = {}): string {
  const r = formatJson(text, { ...BASE_OPTS, ...overrides });
  if (!r.ok) throw new Error(`format failed: ${r.error?.message}`);
  return r.output;
}

/* ------------------------------------------------------------------ */
/* parseJson                                                           */
/* ------------------------------------------------------------------ */

describe('parseJson', () => {
  it('parses valid JSON', () => {
    const r = parseJson('{"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1 });
  });

  it('reports empty input', () => {
    const r = parseJson('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/empty/i);
  });

  it('reports parse error with line and column', () => {
    const text = '{\n  "a": 1,\n  "b":\n}';
    const r = parseJson(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(4);
      expect(r.error.column).toBe(1);
      expect(r.error.position).toBeGreaterThan(0);
      expect(r.error.message.length).toBeGreaterThan(0);
    }
  });

  it('handles multi-line nested errors', () => {
    const text = '[\n 1,\n 2,\n bad\n]';
    const r = parseJson(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBeGreaterThan(1);
  });

  it('reports trailing data as an error', () => {
    const r = parseJson('{}garbage');
    expect(r.ok).toBe(false);
  });

  it('reports unterminated string', () => {
    const r = parseJson('{"a":"unterminated');
    expect(r.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* posToLineColumn                                                      */
/* ------------------------------------------------------------------ */

describe('posToLineColumn', () => {
  it('maps start of text', () => {
    expect(posToLineColumn('abc', 0)).toEqual({ line: 1, column: 1 });
  });
  it('maps second line', () => {
    expect(posToLineColumn('abc\ndef', 4)).toEqual({ line: 2, column: 1 });
  });
  it('maps middle of second line', () => {
    expect(posToLineColumn('abc\ndef', 6)).toEqual({ line: 2, column: 3 });
  });
  it('clamps out-of-range positions', () => {
    expect(posToLineColumn('ab\n', 10)).toEqual({ line: 2, column: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* format: pretty-print                                                 */
/* ------------------------------------------------------------------ */

describe('formatJson: pretty-print', () => {
  it('pretty-prints with 2 spaces by default', () => {
    expect(fmt('{"a":1,"b":[1,2]}')).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  });

  it('uses 4 spaces when configured', () => {
    expect(fmt('{"a":1}', { indent: { kind: 'spaces', count: 4 } })).toBe('{\n    "a": 1\n}');
  });

  it('uses tab when configured', () => {
    expect(fmt('{"a":1}', { indent: { kind: 'tab' } })).toBe('{\n\t"a": 1\n}');
  });

  it('handles custom indent width', () => {
    expect(fmt('{"a":1}', { indent: { kind: 'spaces', count: 6 } })).toBe('{\n      "a": 1\n}');
  });

  it('clamps ridiculous indent values', () => {
    const out = fmt('{"a":1}', { indent: { kind: 'spaces', count: 999 } });
    expect(out.startsWith('{\n          "a"')).toBe(true);
  });

  it('handles empty object', () => {
    expect(fmt('{}')).toBe('{}');
  });

  it('handles empty array', () => {
    expect(fmt('[]')).toBe('[]');
  });

  it('handles deeply nested structures', () => {
    const r = formatJson('{"a":{"b":{"c":[1,2,{"d":null}]}}}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain('\n');
      expect(JSON.parse(r.output)).toEqual({ a: { b: { c: [1, 2, { d: null }] } } });
    }
  });

  it('preserves number precision', () => {
    expect(fmt('{"n":1.5e10}')).toContain('15000000000');
  });
});

/* ------------------------------------------------------------------ */
/* format: minify                                                       */
/* ------------------------------------------------------------------ */

describe('formatJson: minify', () => {
  it('minifies to a single line', () => {
    expect(minifyJson('{\n  "a": 1,\n  "b": [2,3]\n}').output).toBe('{"a":1,"b":[2,3]}');
  });

  it('reports invalid JSON', () => {
    const r = minifyJson('{bad');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message.length).toBeGreaterThan(0);
  });

  it('minify is round-trip-safe', () => {
    const obj = { name: 'x', arr: [1, 2, { k: null }], flag: true };
    const text = JSON.stringify(obj);
    const r = minifyJson(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.parse(r.output)).toEqual(obj);
      expect(r.output.includes('\n')).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* format: sort keys                                                    */
/* ------------------------------------------------------------------ */

describe('formatJson: sort keys', () => {
  it('sorts top-level keys alphabetically', () => {
    expect(fmt('{"b":1,"a":2}', { sortKeys: true })).toBe('{\n  "a": 2,\n  "b": 1\n}');
  });

  it('sorts nested objects recursively', () => {
    const input = '{"z":{"y":1,"x":2},"a":1}';
    expect(fmt(input, { sortKeys: true })).toBe('{\n  "a": 1,\n  "z": {\n    "x": 2,\n    "y": 1\n  }\n}');
  });

  it('does not change array order', () => {
    expect(fmt('[3,1,2]', { sortKeys: true })).toBe('[\n  3,\n  1,\n  2\n]');
  });

  it('without sortKeys, preserves insertion order', () => {
    expect(fmt('{"z":1,"a":2}')).toBe('{\n  "z": 1,\n  "a": 2\n}');
  });

  it('handles empty object when sorting', () => {
    expect(fmt('{}', { sortKeys: true })).toBe('{}');
  });
});

/* ------------------------------------------------------------------ */
/* format: drop nulls                                                   */
/* ------------------------------------------------------------------ */

describe('formatJson: drop nulls', () => {
  it('drops null values from objects', () => {
    expect(fmt('{"a":1,"b":null,"c":3}', { dropNulls: true })).toBe('{\n  "a": 1,\n  "c": 3\n}');
  });

  it('drops null entries from arrays (changes length)', () => {
    expect(fmt('[1,null,2,null,3]', { dropNulls: true })).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('drops nulls recursively', () => {
    const input = '{"a":{"b":null,"c":1},"d":null}';
    expect(fmt(input, { dropNulls: true })).toBe('{\n  "a": {\n    "c": 1\n  }\n}');
  });

  it('keeps nested objects that would become empty (as {})', () => {
    expect(fmt('{"a":1,"b":{"c":null}}', { dropNulls: true })).toBe('{\n  "a": 1,\n  "b": {}\n}');
  });

  it('keeps false, 0, and empty string (not null)', () => {
    expect(fmt('{"a":false,"b":0,"c":""}', { dropNulls: true })).toBe('{\n  "a": false,\n  "b": 0,\n  "c": ""\n}');
  });
});

/* ------------------------------------------------------------------ */
/* format: escape unicode                                               */
/* ------------------------------------------------------------------ */

describe('formatJson: escape unicode', () => {
  it('escapes non-ASCII characters in strings', () => {
    expect(fmt('{"name":"café"}', { escapeUnicode: true })).toBe('{\n  "name": "caf\\u00e9"\n}');
  });

  it('escapes high code points using surrogate pairs', () => {
    const r = formatJson('{"emoji":"😀"}', { ...defaultOptions(), escapeUnicode: true, indent: { kind: 'spaces', count: 2 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain('\\ud83d\\ude00');
  });

  it('escapes control characters in strings', () => {
    expect(fmt('{"a":"\\n"}', { escapeUnicode: true })).toContain('\\n');
  });

  it('does not affect keys when not a string value', () => {
    expect(fmt('{"café":1}', { escapeUnicode: true })).toBe('{\n  "caf\\u00e9": 1\n}');
  });

  it('preserves non-ASCII when option is off', () => {
    expect(fmt('{"name":"café"}')).toContain('café');
  });
});

/* ------------------------------------------------------------------ */
/* format: combined options                                             */
/* ------------------------------------------------------------------ */

describe('formatJson: combined options', () => {
  it('sort + drop nulls + 4 spaces', () => {
    const input = '{"z":null,"a":1,"m":{"y":null,"x":2}}';
    const expected = '{\n    "a": 1,\n    "m": {\n        "x": 2\n    }\n}';
    expect(fmt(input, { sortKeys: true, dropNulls: true, indent: { kind: 'spaces', count: 4 } })).toBe(expected);
  });

  it('round-trips with parse', () => {
    const obj = { z: null, a: 1, list: [{ x: null, y: 'hi' }] };
    const text = JSON.stringify(obj);
    const out = fmt(text, { sortKeys: true, dropNulls: true });
    expect(JSON.parse(out)).toEqual({ a: 1, list: [{ y: 'hi' }] });
  });
});

/* ------------------------------------------------------------------ */
/* format: stats                                                        */
/* ------------------------------------------------------------------ */

describe('formatJson: stats', () => {
  it('reports input/output bytes, key count, depth, type counts', () => {
    const text = '{"a":1,"b":{"c":[1,2,null]}}';
    const r = formatJson(text, defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok && r.stats) {
      expect(r.stats.inputBytes).toBeGreaterThan(0);
      expect(r.stats.outputBytes).toBeGreaterThan(0);
      expect(r.stats.totalKeys).toBe(3);
      expect(r.stats.maxDepth).toBeGreaterThanOrEqual(3);
      expect(r.stats.typeCounts.number).toBeGreaterThan(0);
      expect(r.stats.typeCounts.null).toBe(1);
    }
  });

  it('reports depth 1 for flat object', () => {
    const r = formatJson('{"a":1,"b":2}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok && r.stats) expect(r.stats.maxDepth).toBe(1);
  });

  it('reports depth for arrays of arrays', () => {
    const r = formatJson('[[[1]]]', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok && r.stats) expect(r.stats.maxDepth).toBe(3);
  });

  it('reports type counts for primitives', () => {
    const r = formatJson('[true, false, null, "s", 1, 1.5]', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok && r.stats) {
      expect(r.stats.typeCounts.boolean).toBe(2);
      expect(r.stats.typeCounts.null).toBe(1);
      expect(r.stats.typeCounts.string).toBe(1);
      expect(r.stats.typeCounts.number).toBe(2);
    }
  });
});

/* ------------------------------------------------------------------ */
/* format: error handling                                               */
/* ------------------------------------------------------------------ */

describe('formatJson: error handling', () => {
  it('returns error on bad JSON', () => {
    const r = formatJson('not json', defaultOptions());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error?.message.length).toBeGreaterThan(0);
  });

  it('returns error for empty input', () => {
    const r = formatJson('', defaultOptions());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error?.message).toMatch(/empty/i);
  });

  it('returns error for mismatched braces', () => {
    const r = formatJson('{"a":[1,2}', defaultOptions());
    expect(r.ok).toBe(false);
  });

  it('returns error on bad escape sequence', () => {
    const r = formatJson('{"a":"\\x"}', defaultOptions());
    expect(r.ok).toBe(false);
  });

  it('returns error on unquoted key', () => {
    const r = formatJson('{a:1}', defaultOptions());
    expect(r.ok).toBe(false);
  });

  it('returns error on single-quoted key', () => {
    const r = formatJson("{'a':1}", defaultOptions());
    expect(r.ok).toBe(false);
  });

  it('returns error on trailing comma', () => {
    const r = formatJson('[1,2,3,]', defaultOptions());
    expect(r.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* JSON spec coverage                                                   */
/* ------------------------------------------------------------------ */

describe('formatJson: JSON spec coverage', () => {
  it('handles all primitive types', () => {
    expect(fmt('{"s":"hello","n":42,"f":3.14,"t":true,"fa":false,"z":null}')).toContain('"hello"');
    expect(fmt('{"s":"hello","n":42,"f":3.14,"t":true,"fa":false,"z":null}')).toContain('null');
  });

  it('handles negative and zero numbers', () => {
    expect(fmt('{"a":-1,"b":0,"c":-0}')).toContain('"a": -1');
    expect(fmt('{"a":-1,"b":0,"c":-0}')).toContain('"b": 0');
  });

  it('handles escaped characters in strings', () => {
    expect(fmt('{"q":"he said \\"hi\\""}')).toContain('\\"hi\\"');
  });

  it('handles large JSON', () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 100; i++) big[`k${i}`] = i;
    const text = JSON.stringify(big);
    const r = formatJson(text, defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok && r.stats) expect(r.stats.totalKeys).toBe(100);
  });
});

/* ------------------------------------------------------------------ */
/* tokens (syntax highlighting)                                         */
/* ------------------------------------------------------------------ */

describe('formatJson: tokens', () => {
  it('emits tokens alongside the formatted output', () => {
    const r = formatJson('{"a":1}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokens).toBeDefined();
      expect(r.tokens!.length).toBeGreaterThan(0);
      expect(tokensToText(r.tokens!)).toBe(r.output);
    }
  });

  it('classifies keys as "key"', () => {
    const r = formatJson('{"name":"x"}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const keys = r.tokens!.filter((t) => t.type === 'key');
      expect(keys.length).toBe(1);
      expect(keys[0].text).toBe('"name"');
    }
  });

  it('classifies strings as "string"', () => {
    const r = formatJson('{"a":"hello"}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const strs = r.tokens!.filter((t) => t.type === 'string');
      expect(strs.length).toBe(1);
      expect(strs[0].text).toBe('"hello"');
    }
  });

  it('classifies numbers as "number"', () => {
    const r = formatJson('[1, 2.5, -3, 1e10]', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const nums = r.tokens!.filter((t) => t.type === 'number');
      expect(nums.map((t) => t.text)).toEqual(['1', '2.5', '-3', '10000000000']);
    }
  });

  it('classifies booleans and null', () => {
    const r = formatJson('[true, false, null]', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokens!.filter((t) => t.type === 'boolean').map((t) => t.text)).toEqual(['true', 'false']);
      expect(r.tokens!.filter((t) => t.type === 'null').map((t) => t.text)).toEqual(['null']);
    }
  });

  it('classifies brackets, commas, colons as "punct"', () => {
    const r = formatJson('{"a":1,"b":2}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const punct = r.tokens!.filter((t) => t.type === 'punct').map((t) => t.text).join('');
      expect(punct).toBe('{:,:}');
    }
  });

  it('emits whitespace tokens for pretty-print', () => {
    const r = formatJson('{"a":1}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ws = r.tokens!.filter((t) => t.type === 'whitespace');
      expect(ws.length).toBeGreaterThan(0);
      expect(ws.some((t) => t.text.includes('\n'))).toBe(true);
    }
  });

  it('emits no newline whitespace tokens in minify mode', () => {
    const r = minifyJson('{"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok && r.tokens) {
      const ws = r.tokens.filter((t) => t.type === 'whitespace');
      expect(ws.some((t) => t.text.includes('\n'))).toBe(false);
    }
  });

  it('tokens reconstruct the formatted string with sortKeys', () => {
    const r = formatJson('{"b":2,"a":1}', { ...defaultOptions(), sortKeys: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(tokensToText(r.tokens!)).toBe(r.output);
    }
  });

  it('escapes non-ASCII inside token text when escapeUnicode is on', () => {
    const r = formatJson('{"name":"café"}', { ...defaultOptions(), escapeUnicode: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const text = tokensToText(r.tokens!);
      expect(text).toContain('caf\\u00e9');
      const strTok = r.tokens!.find((t) => t.type === 'string');
      expect(strTok?.text).toContain('\\u00e9');
    }
  });

  it('handles nested structure with all token types', () => {
    const r = formatJson('{"a":[1,{"b":true},null]}', defaultOptions());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const types = new Set(r.tokens!.map((t) => t.type));
      expect(types.has('key')).toBe(true);
      expect(types.has('string')).toBe(false);
      expect(types.has('number')).toBe(true);
      expect(types.has('boolean')).toBe(true);
      expect(types.has('null')).toBe(true);
      expect(types.has('punct')).toBe(true);
      expect(types.has('whitespace')).toBe(true);
    }
  });
});