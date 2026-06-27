export type Indent =
  | { kind: 'spaces'; count: number }
  | { kind: 'tab' }
  | { kind: 'minify' };

export interface FormatOptions {
  indent: Indent;
  sortKeys: boolean;
  dropNulls: boolean;
  escapeUnicode: boolean;
}

export type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punct' | 'whitespace';

export interface Token {
  type: TokenType;
  text: string;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
  position: number;
}

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: ParseError };

export interface FormatStats {
  inputBytes: number;
  outputBytes: number;
  totalKeys: number;
  maxDepth: number;
  typeCounts: Record<string, number>;
}

export interface FormatResult {
  ok: boolean;
  output: string;
  tokens?: Token[];
  stats?: FormatStats;
  error?: ParseError;
}

export function defaultOptions(): FormatOptions {
  return {
    indent: { kind: 'spaces', count: 2 },
    sortKeys: false,
    dropNulls: false,
    escapeUnicode: false,
  };
}

function indentToArg(indent: Indent): string | number {
  if (indent.kind === 'minify') return 0;
  if (indent.kind === 'tab') return '\t';
  return Math.max(0, Math.min(10, indent.count));
}

export function parseJson(text: string): ParseResult {
  if (text.length === 0) {
    return { ok: false, error: { message: 'Input is empty', line: 1, column: 1, position: 0 } };
  }
  const result = customParse(text);
  if (result.ok) return { ok: true, value: result.value };
  const { line, column } = posToLineColumn(text, result.pos);
  return { ok: false, error: { message: result.message, line, column, position: result.pos } };
}

interface CustomOk { ok: true; value: unknown; pos: number }
interface CustomErr { ok: false; message: string; pos: number }
type CustomResult = CustomOk | CustomErr;

function customParse(text: string): CustomResult {
  let p = skipWs(text, 0);
  if (p >= text.length) return { ok: false, message: 'Unexpected end of input', pos: p };
  const r = parseValue(text, p);
  if (!r.ok) return r;
  p = skipWs(text, r.pos);
  if (p < text.length) {
    return { ok: false, message: `Unexpected trailing data after JSON value`, pos: p };
  }
  return { ok: true, value: r.value, pos: r.pos };
}

function skipWs(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++;
    else break;
  }
  return i;
}

function parseValue(text: string, p: number): CustomResult {
  const i = skipWs(text, p);
  if (i >= text.length) return { ok: false, message: 'Unexpected end of input', pos: i };
  const c = text.charCodeAt(i);
  if (c === 0x7b) return parseObject(text, i);
  if (c === 0x5b) return parseArray(text, i);
  if (c === 0x22) return parseString(text, i);
  if (c === 0x74) return parseLiteral(text, i, 'true', true);
  if (c === 0x66) return parseLiteral(text, i, 'false', false);
  if (c === 0x6e) return parseLiteral(text, i, 'null', null);
  if (c === 0x2d || (c >= 0x30 && c <= 0x39)) return parseNumber(text, i);
  return { ok: false, message: `Unexpected character '${text[i]}'`, pos: i };
}

function parseObject(text: string, start: number): CustomResult {
  let i = skipWs(text, start + 1);
  if (i >= text.length) return { ok: false, message: 'Unterminated object', pos: start };
  if (text.charCodeAt(i) === 0x7d) return { ok: true, value: {}, pos: i + 1 };
  const obj: Record<string, unknown> = {};
  while (true) {
    i = skipWs(text, i);
    if (i >= text.length || text.charCodeAt(i) !== 0x22) {
      return { ok: false, message: 'Expected string key', pos: i };
    }
    const keyRes = parseString(text, i);
    if (!keyRes.ok) return keyRes;
    const key = keyRes.value as string;
    i = skipWs(text, keyRes.pos);
    if (text.charCodeAt(i) !== 0x3a) return { ok: false, message: "Expected ':' after object key", pos: i };
    i = skipWs(text, i + 1);
    const valRes = parseValue(text, i);
    if (!valRes.ok) return valRes;
    obj[key] = valRes.value;
    i = skipWs(text, valRes.pos);
    const c = text.charCodeAt(i);
    if (c === 0x7d) return { ok: true, value: obj, pos: i + 1 };
    if (c !== 0x2c) return { ok: false, message: "Expected ',' or '}'", pos: i };
    i++;
  }
}

function parseArray(text: string, start: number): CustomResult {
  let i = skipWs(text, start + 1);
  if (i >= text.length) return { ok: false, message: 'Unterminated array', pos: start };
  if (text.charCodeAt(i) === 0x5d) return { ok: true, value: [], pos: i + 1 };
  const arr: unknown[] = [];
  while (true) {
    const valRes = parseValue(text, i);
    if (!valRes.ok) return valRes;
    arr.push(valRes.value);
    i = skipWs(text, valRes.pos);
    const c = text.charCodeAt(i);
    if (c === 0x5d) return { ok: true, value: arr, pos: i + 1 };
    if (c !== 0x2c) return { ok: false, message: "Expected ',' or ']'", pos: i };
    i++;
  }
}

function parseString(text: string, start: number): CustomResult {
  let i = start + 1;
  let out = '';
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === 0x22) return { ok: true, value: out, pos: i + 1 };
    if (c === 0x5c) {
      if (i + 1 >= text.length) return { ok: false, message: 'Unterminated string escape', pos: i };
      const esc = text[i + 1];
      switch (esc) {
        case '"': out += '"'; i += 2; break;
        case '\\': out += '\\'; i += 2; break;
        case '/': out += '/'; i += 2; break;
        case 'b': out += '\b'; i += 2; break;
        case 'f': out += '\f'; i += 2; break;
        case 'n': out += '\n'; i += 2; break;
        case 'r': out += '\r'; i += 2; break;
        case 't': out += '\t'; i += 2; break;
        case 'u': {
          if (i + 6 > text.length) return { ok: false, message: 'Truncated \\u escape', pos: i };
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            return { ok: false, message: 'Invalid \\u escape sequence', pos: i };
          }
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          break;
        }
        default:
          return { ok: false, message: `Invalid escape '\\${esc}'`, pos: i };
      }
      continue;
    }
    if (c < 0x20) {
      return { ok: false, message: 'Unescaped control character in string', pos: i };
    }
    out += text[i];
    i++;
  }
  return { ok: false, message: 'Unterminated string', pos: start };
}

function parseLiteral(text: string, start: number, word: string, value: unknown): CustomResult {
  const end = start + word.length;
  if (text.slice(start, end) === word) return { ok: true, value, pos: end };
  return { ok: false, message: `Expected '${word}'`, pos: start };
}

function parseNumber(text: string, start: number): CustomResult {
  let i = start;
  if (text.charCodeAt(i) === 0x2d) i++;
  if (i >= text.length) return { ok: false, message: 'Invalid number', pos: start };
  const c0 = text.charCodeAt(i);
  if (c0 === 0x30) {
    i++;
  } else if (c0 >= 0x31 && c0 <= 0x39) {
    while (i < text.length && text.charCodeAt(i) >= 0x30 && text.charCodeAt(i) <= 0x39) i++;
  } else {
    return { ok: false, message: 'Invalid number', pos: start };
  }
  if (text.charCodeAt(i) === 0x2e) {
    i++;
    const startFrac = i;
    while (i < text.length && text.charCodeAt(i) >= 0x30 && text.charCodeAt(i) <= 0x39) i++;
    if (i === startFrac) return { ok: false, message: 'Invalid number: missing digits after decimal', pos: i };
  }
  const e = text.charCodeAt(i);
  if (e === 0x65 || e === 0x45) {
    i++;
    const s = text.charCodeAt(i);
    if (s === 0x2b || s === 0x2d) i++;
    const startExp = i;
    while (i < text.length && text.charCodeAt(i) >= 0x30 && text.charCodeAt(i) <= 0x39) i++;
    if (i === startExp) return { ok: false, message: 'Invalid number: missing exponent digits', pos: i };
  }
  const numStr = text.slice(start, i);
  const n = Number(numStr);
  if (!Number.isFinite(n)) return { ok: false, message: 'Invalid number', pos: start };
  return { ok: true, value: n, pos: i };
}

export function posToLineColumn(text: string, pos: number): { line: number; column: number } {
  let line = 1;
  let col = 1;
  const n = Math.max(0, Math.min(text.length, pos));
  for (let i = 0; i < n; i++) {
    if (text.charCodeAt(i)  === 10) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

interface WalkState {
  keys: number;
  depth: number;
  maxDepth: number;
  counts: Record<string, number>;
}

function bumpCount(counts: Record<string, number>, value: unknown): void {
  let key: string;
  if (value === null) key = 'null';
  else if (Array.isArray(value)) key = 'array';
  else if (typeof value === 'object') key = 'object';
  else key = typeof value;
  counts[key] = (counts[key] ?? 0) + 1;
}

export function transform(value: unknown, options: FormatOptions): { value: unknown; stats: FormatStats } {
  const counts: Record<string, number> = {};
  const state: WalkState = { keys: 0, depth: 0, maxDepth: 0, counts };
  const result = walk(value, options, state, 0);
  const stats: FormatStats = {
    inputBytes: 0,
    outputBytes: 0,
    totalKeys: state.keys,
    maxDepth: state.maxDepth,
    typeCounts: { ...counts },
  };
  return { value: result, stats };
}

function walk(value: unknown, options: FormatOptions, state: WalkState, depth: number): unknown {
  if (depth > state.maxDepth) state.maxDepth = depth;
  bumpCount(state.counts, value);

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const v = walk(value[i], options, state, depth + 1);
      if (options.dropNulls && v === null) continue;
      out.push(v);
    }
    return out;
  }

  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return {};
    state.keys += keys.length;

    const orderedKeys = options.sortKeys ? [...keys].sort() : keys;

    const out: Record<string, unknown> = {};
    for (const k of orderedKeys) {
      const v = walk(obj[k], options, state, depth + 1);
      if (options.dropNulls && v === null) continue;
      out[k] = v;
    }
    return out;
  }

  return value;
}

function makeReplacer() {
  return function replacer(_key: string, value: unknown): unknown {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return null;
    }
    return value;
  };
}

function escapeNonAsciiOutsideEscapes(s: string): string {
  let out = '';
  let inString = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inString) {
      if (c === '\\' && i + 1 < s.length) {
        out += c + s[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') {
        inString = false;
        out += c;
        i++;
        continue;
      }
      const cp = s.codePointAt(i);
      if (cp === undefined) {
        i++;
        continue;
      }
      if (cp < 0x20) {
        switch (cp) {
          case 0x08: out += '\\b'; break;
          case 0x09: out += '\\t'; break;
          case 0x0a: out += '\\n'; break;
          case 0x0c: out += '\\f'; break;
          case 0x0d: out += '\\r'; break;
          default: out += '\\u' + cp.toString(16).padStart(4, '0');
        }
        i++;
        continue;
      }
      if (cp > 0x7f) {
        if (cp <= 0xffff) {
          out += '\\u' + cp.toString(16).padStart(4, '0');
          i++;
        } else {
          const hi = ((cp - 0x10000) >> 10) | 0xd800;
          const lo = ((cp - 0x10000) & 0x3ff) | 0xdc00;
          out += '\\u' + hi.toString(16).padStart(4, '0');
          out += '\\u' + lo.toString(16).padStart(4, '0');
          i += 2;
        }
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (c === '"') inString = true;
    out += c;
    i++;
  }
  return out;
}

export function formatJson(text: string, options: FormatOptions): FormatResult {
  const inputBytes = textLengthBytes(text);
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return { ok: false, output: '', error: parsed.error };
  }

  const { value, stats } = transform(parsed.value, options);
  stats.inputBytes = inputBytes;

  try {
    const indentArg = indentToArg(options.indent);
    let output =
      indentArg === 0
        ? JSON.stringify(value, makeReplacer())
        : JSON.stringify(value, makeReplacer(), indentArg);
    if (options.escapeUnicode) output = escapeNonAsciiOutsideEscapes(output);
    const tokens = tokenize(value, options.indent, options.escapeUnicode);
    stats.outputBytes = textLengthBytes(output);
    return { ok: true, output, tokens, stats };
  } catch (e) {
    return {
      ok: false,
      output: '',
      error: {
        message: e instanceof Error ? e.message : String(e),
        line: 0,
        column: 0,
        position: 0,
      },
    };
  }
}

function textLengthBytes(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  return s.length;
}

/* ------------------------------------------------------------------ */
/* Tokenizer: walk the JS value and emit classified tokens             */
/* ------------------------------------------------------------------ */

function tokenize(value: unknown, indent: Indent, escapeUnicode: boolean): Token[] {
  const tokens: Token[] = [];
  const indentUnit = indent.kind === 'minify' ? '' : indent.kind === 'tab' ? '\t' : ' '.repeat(indentToArg(indent) as number);
  const newline = indent.kind === 'minify' ? '' : '\n';
  walkTokens(value, tokens, indentUnit, newline, 0, escapeUnicode);
  return tokens;
}

function pushNewline(tokens: Token[], indentUnit: string, depth: number): void {
  tokens.push({ type: 'whitespace', text: '\n' + indentUnit.repeat(depth) });
}

function pushSeparator(tokens: Token[], indentUnit: string, newline: string, depth: number, afterComma: boolean): void {
  tokens.push({ type: 'punct', text: ',' });
  if (newline) pushNewline(tokens, indentUnit, depth);
  else if (afterComma) tokens.push({ type: 'whitespace', text: ' ' });
}

function walkTokens(
  value: unknown,
  tokens: Token[],
  indentUnit: string,
  newline: string,
  depth: number,
  escapeUnicode: boolean,
): void {
  if (value === null) {
    tokens.push({ type: 'null', text: 'null' });
    return;
  }
  if (typeof value === 'boolean') {
    tokens.push({ type: 'boolean', text: value ? 'true' : 'false' });
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      tokens.push({ type: 'null', text: 'null' });
      return;
    }
    tokens.push({ type: 'number', text: formatNumber(value) });
    return;
  }
  if (typeof value === 'string') {
    tokens.push({ type: 'string', text: jsonStringifyString(value, escapeUnicode) });
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      tokens.push({ type: 'punct', text: '[]' });
      return;
    }
    tokens.push({ type: 'punct', text: '[' });
    if (newline) pushNewline(tokens, indentUnit, depth + 1);
    for (let i = 0; i < value.length; i++) {
      walkTokens(value[i], tokens, indentUnit, newline, depth + 1, escapeUnicode);
      if (i < value.length - 1) pushSeparator(tokens, indentUnit, newline, depth + 1, true);
    }
    if (newline) pushNewline(tokens, indentUnit, depth);
    tokens.push({ type: 'punct', text: ']' });
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      tokens.push({ type: 'punct', text: '{}' });
      return;
    }
    tokens.push({ type: 'punct', text: '{' });
    if (newline) pushNewline(tokens, indentUnit, depth + 1);
    for (let i = 0; i < keys.length; i++) {
      tokens.push({ type: 'key', text: jsonStringifyString(keys[i], escapeUnicode) });
      tokens.push({ type: 'punct', text: ':' });
      if (newline) tokens.push({ type: 'whitespace', text: ' ' });
      walkTokens(obj[keys[i]], tokens, indentUnit, newline, depth + 1, escapeUnicode);
      if (i < keys.length - 1) pushSeparator(tokens, indentUnit, newline, depth + 1, true);
    }
    if (newline) pushNewline(tokens, indentUnit, depth);
    tokens.push({ type: 'punct', text: '}' });
    return;
  }
  tokens.push({ type: 'string', text: JSON.stringify(String(value)) });
}

function formatNumber(n: number): string {
  if (Object.is(n, -0)) return '0';
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return String(n);
  return String(n);
}

export function tokensToText(tokens: Token[]): string {
  let s = '';
  for (const t of tokens) s += t.text;
  return s;
}

function escapeStringValue(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i);
    if (cp === undefined) continue;
    if (cp < 0x20) {
      switch (cp) {
        case 0x08: out += '\\b'; break;
        case 0x09: out += '\\t'; break;
        case 0x0a: out += '\\n'; break;
        case 0x0c: out += '\\f'; break;
        case 0x0d: out += '\\r'; break;
        default: out += '\\u' + cp.toString(16).padStart(4, '0');
      }
      continue;
    }
    if (cp === 0x22) out += '\\"';
    else if (cp === 0x5c) out += '\\\\';
    else if (cp > 0x7f) {
      if (cp <= 0xffff) {
        out += '\\u' + cp.toString(16).padStart(4, '0');
      } else {
        const hi = ((cp - 0x10000) >> 10) | 0xd800;
        const lo = ((cp - 0x10000) & 0x3ff) | 0xdc00;
        out += '\\u' + hi.toString(16).padStart(4, '0');
        out += '\\u' + lo.toString(16).padStart(4, '0');
        i++;
      }
    }
    else out += String.fromCodePoint(cp);
  }
  return out;
}

function jsonStringifyString(s: string, escapeUnicode: boolean): string {
  const body = escapeUnicode ? escapeStringValue(s) : JSON.stringify(s).slice(1, -1);
  return `"${body}"`;
}

export function minifyJson(text: string): FormatResult {
  return formatJson(text, { ...defaultOptions(), indent: { kind: 'minify' } });
}

export const SAMPLE = JSON.stringify(
  {
    name: 'Ada Lovelace',
    born: 1815,
    pioneer: true,
    fields: ['mathematics', 'computing'],
    address: { city: 'London', country: 'UK' },
    spouse: null,
  },
  null,
  2,
);