// Serialization codec implementations: decode/encode between binary
// serialization formats and JSON-friendly JS structures.
//
// Everything here is 100% client-side. No network access.
//
// Libraries (browser-friendly ESM):
//   - bson              BSON
//   - @msgpack/msgpack  MessagePack
//   - cbor-x            CBOR
// Hand-rolled (no schema needed):
//   - Protobuf          generic wire-format decoder (no .proto)
//   - Pickle            Python pickle (protocols 0-4, best effort)
//   - Java              Java Object Serialization Stream (best effort)
//   - Plist             Apple property list (XML + ASCII + binary bplist00)

import { BSON } from 'bson';
import { decode as msgpackDecode, encode as msgpackEncode } from '@msgpack/msgpack';
import { decode as cborDecode, encode as cborEncode } from 'cbor-x';

/* ------------------------------------------------------------------ */
/* Bytes / number helpers                                              */
/* ------------------------------------------------------------------ */

const textDecoder = new TextDecoder('utf-8', { fatal: false });

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

function isPrintableUtf8(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let s: string;
  try {
    s = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Normalize: turn any decoded value into JSON-serializable form      */
/* ------------------------------------------------------------------ */

export function normalize(value: unknown, seen: WeakMap<object, boolean> = new WeakMap()): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { __type: 'number', value: String(value) };
    return value;
  }
  if (typeof value === 'bigint') return { __type: 'bigint', value: value.toString() };

  if (value instanceof Uint8Array) return bytesTag(value);
  if (value instanceof ArrayBuffer) return bytesTag(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) {
    const v = value as ArrayBufferView & { buffer: ArrayBuffer };
    return bytesTag(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  }
  if (value instanceof Date) return { __type: 'date', iso: value.toISOString() };
  if (value instanceof Map) {
    return {
      __type: 'map',
      entries: [...value.entries()].map(([k, val]) => [normalizeKey(k, seen), normalize(val, seen)]),
    };
  }
  if (value instanceof Set) {
    return { __type: 'set', values: [...value].map((v) => normalize(v, seen)) };
  }

  if (typeof value === 'object') {
    const cn = (value as { constructor?: { name?: string } }).constructor?.name;
    switch (cn) {
      case 'ObjectId': return { __type: 'ObjectId', value: String(value) };
      case 'Decimal128': return { __type: 'decimal', value: String(value) };
      case 'Binary': return bytesTag((value as { buffer: Uint8Array }).buffer);
      case 'Code': return { __type: 'code', code: String((value as { code: unknown }).code) };
      case 'DBRef':
        return { __type: 'DBRef', collection: (value as { collection: string }).collection, oid: String((value as { oid: unknown }).oid), db: (value as { db?: string }).db };
      case 'Timestamp': return { __type: 'timestamp', value: String(value) };
      case 'MaxKey': return { __type: 'MaxKey' };
      case 'MinKey': return { __type: 'MinKey' };
      case 'Long': return { __type: 'int64', value: String(value) };
      case 'Double': return { __type: 'double', value: Number(value) };
      case 'Int32': return Number(value);
      case 'UUID': return { __type: 'UUID', value: String(value) };
      default: break;
    }

    if (seen.has(value)) return { __type: 'circular' };
    seen.set(value, true);

    if (Array.isArray(value)) return value.map((v) => normalize(v, seen));

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalize(v, seen);
    }
    return out;
  }
  return String(value);
}

function normalizeKey(k: unknown, seen: WeakMap<object, boolean>): unknown {
  if (typeof k === 'object' && k !== null) return normalize(k, seen);
  return k;
}

function bytesTag(bytes: Uint8Array): { __type: 'bytes'; base64: string; length: number } {
  return { __type: 'bytes', base64: bytesToBase64(bytes), length: bytes.length };
}

/* ------------------------------------------------------------------ */
/* Format registry                                                     */
/* ------------------------------------------------------------------ */

export interface FormatInfo {
  id: string;
  label: string;
  supportsEncode: boolean;
  description: string;
}

export const FORMATS: FormatInfo[] = [
  { id: 'json', label: 'JSON', supportsEncode: true, description: 'Human-readable text. The common interchange format.' },
  { id: 'bson', label: 'BSON', supportsEncode: true, description: 'Binary JSON, used by MongoDB.' },
  { id: 'msgpack', label: 'MessagePack', supportsEncode: true, description: 'Compact binary JSON-like format.' },
  { id: 'cbor', label: 'CBOR', supportsEncode: true, description: 'Concise Binary Object Representation (RFC 8949).' },
  { id: 'protobuf', label: 'Protobuf (no schema)', supportsEncode: false, description: 'Generic wire-format decode without a .proto file.' },
  { id: 'pickle', label: 'Python Pickle', supportsEncode: false, description: 'Python object serialization (protocols 0-4, best effort).' },
  { id: 'java', label: 'Java Serialized', supportsEncode: false, description: 'Java Object Serialization Stream (best effort).' },
  { id: 'plist', label: 'Property List (plist)', supportsEncode: false, description: 'Apple XML, ASCII, and binary property lists.' },
];

export function getFormat(id: string): FormatInfo | undefined {
  return FORMATS.find((f) => f.id === id);
}

/* ------------------------------------------------------------------ */
/* Result types + dispatch                                             */
/* ------------------------------------------------------------------ */

export type DecodeResult = { ok: true; value: unknown } | { ok: false; error: string };
export type EncodeResult = { ok: true; bytes: Uint8Array } | { ok: false; error: string };

export function decode(formatId: string, bytes: Uint8Array): DecodeResult {
  try {
    switch (formatId) {
      case 'json': return { ok: true, value: JSON.parse(utf8(bytes)) };
      case 'bson': return { ok: true, value: normalize(BSON.deserialize(bytes, { useBigInt64: true })) };
      case 'msgpack': return { ok: true, value: normalize(msgpackDecode(bytes)) };
      case 'cbor': return { ok: true, value: normalize(cborDecode(bytes)) };
      case 'protobuf': return { ok: true, value: normalizeProtobuf(bytes) };
      case 'pickle': return { ok: true, value: normalize(pickleDecode(bytes)) };
      case 'java': return { ok: true, value: normalize(javaDecode(bytes)) };
      case 'plist': return { ok: true, value: normalize(plistDecode(bytes)) };
      default: return { ok: false, error: `Unknown format "${formatId}"` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function encode(formatId: string, json: unknown): EncodeResult {
  try {
    switch (formatId) {
      case 'json': return { ok: true, bytes: new TextEncoder().encode(JSON.stringify(json, null, 2)) };
      case 'bson': return { ok: true, bytes: BSON.serialize(json as Record<string, unknown>) };
      case 'msgpack': return { ok: true, bytes: msgpackEncode(json) };
      case 'cbor': return { ok: true, bytes: cborEncode(json) };
      default: return { ok: false, error: `Encoding "${formatId}" is not supported` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Protobuf: generic wire-format decoder (no schema)                   */
/* ------------------------------------------------------------------ */

interface PbReader {
  bytes: Uint8Array;
  pos: number;
}

function pbReadVarint(r: PbReader): bigint {
  let result = 0n;
  let shift = 0n;
  while (true) {
    if (r.pos >= r.bytes.length) throw new Error('Protobuf: truncated varint');
    const b = r.bytes[r.pos++];
    result |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) return result;
    shift += 7n;
    if (shift > 70n) throw new Error('Protobuf: varint too long');
  }
}

function pbVarintToValue(v: bigint): unknown {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
    return { __type: 'bigint', value: v.toString() };
  }
  return Number(v);
}

function pbDecodeFields(r: PbReader, end: number): Record<string, unknown[]> {
  const fields: Record<string, unknown[]> = {};
  while (r.pos < end) {
    const tag = pbReadVarint(r);
    const fieldNo = Number(tag >> 3n);
    const wireType = Number(tag & 0x7n);
    let value: unknown;
    switch (wireType) {
      case 0: value = pbVarintToValue(pbReadVarint(r)); break;
      case 1: {
        if (r.pos + 8 > r.bytes.length) throw new Error('Protobuf: truncated fixed64');
        const chunk = r.bytes.subarray(r.pos, (r.pos += 8));
        value = { __type: 'fixed64', base64: bytesToBase64(chunk) };
        break;
      }
      case 2: {
        const len = Number(pbReadVarint(r));
        if (len < 0 || r.pos + len > r.bytes.length) throw new Error('Protobuf: truncated length-delimited');
        const chunk = r.bytes.subarray(r.pos, (r.pos += len));
        value = pbDecodeLengthDelimited(chunk);
        break;
      }
      case 5: {
        if (r.pos + 4 > r.bytes.length) throw new Error('Protobuf: truncated fixed32');
        const chunk = r.bytes.subarray(r.pos, (r.pos += 4));
        value = { __type: 'fixed32', base64: bytesToBase64(chunk) };
        break;
      }
      case 3: value = pbReadGroup(r, fieldNo); break;
      case 4: throw new Error('Protobuf: unexpected end-group');
      default: throw new Error(`Protobuf: unknown wire type ${wireType}`);
    }
    (fields[String(fieldNo)] ??= []).push(value);
  }
  return fields;
}

function pbReadGroup(r: PbReader, groupFieldNo: number): Record<string, unknown[]> {
  const start = r.pos;
  while (r.pos < r.bytes.length) {
    const tagStart = r.pos;
    const tag = pbReadVarint(r);
    const fno = Number(tag >> 3n);
    const wt = Number(tag & 0x7n);
    if (wt === 4 && fno === groupFieldNo) {
      const slice = r.bytes.subarray(start, tagStart);
      const sub: PbReader = { bytes: slice, pos: 0 };
      return pbDecodeFields(sub, slice.length);
    }
    switch (wt) {
      case 0: pbReadVarint(r); break;
      case 1: r.pos += 8; break;
      case 2: { const l = Number(pbReadVarint(r)); r.pos += l; break; }
      case 5: r.pos += 4; break;
      case 3: pbReadGroup(r, fno); break;
      case 4: throw new Error('Protobuf: unexpected end-group');
      default: throw new Error(`Protobuf: bad wire type in group ${wt}`);
    }
  }
  throw new Error('Protobuf: unterminated group');
}

function pbDecodeLengthDelimited(chunk: Uint8Array): unknown {
  if (chunk.length === 0) return { __type: 'bytes', base64: '', length: 0 };
  try {
    const sub: PbReader = { bytes: chunk, pos: 0 };
    const fields = pbDecodeFields(sub, chunk.length);
    if (sub.pos === chunk.length && Object.keys(fields).length > 0) return fields;
  } catch {
    /* not a clean nested message */
  }
  if (isPrintableUtf8(chunk)) return utf8(chunk);
  return bytesTag(chunk);
}

function normalizeProtobuf(bytes: Uint8Array): unknown {
  if (bytes.length === 0) return null;
  const r: PbReader = { bytes, pos: 0 };
  const fields = pbDecodeFields(r, bytes.length);
  if (r.pos !== bytes.length) throw new Error('Protobuf: trailing data after message');
  return fields;
}

/* ------------------------------------------------------------------ */
/* Python Pickle decoder (protocols 0-4, best effort)                 */
/* ------------------------------------------------------------------ */

const MARK = Symbol('mark');

const OP = {
  PROTO: 0x80, STOP: 0x2e, FRAME: 0x95,
  INT: 0x49, BININT: 0x4a, BININT1: 0x4b, BININT2: 0x4d,
  LONG: 0x4c, LONG1: 0x8a, LONG4: 0x8b,
  FLOAT: 0x46, BINFLOAT: 0x47,
  STRING: 0x53, BINSTRING: 0x54, SHORT_BINSTRING: 0x55,
  BINUNICODE: 0x58, SHORT_BINUNICODE: 0x8c, BINUNICODE8: 0x8d,
  BINBYTES: 0x42, SHORT_BINBYTES: 0x43, BINBYTES8: 0x8e, BYTEARRAY8: 0x96,
  NONE: 0x4e, NEWTRUE: 0x88, NEWFALSE: 0x89,
  EMPTY_TUPLE: 0x29, TUPLE: 0x74, TUPLE1: 0x85, TUPLE2: 0x86, TUPLE3: 0x87,
  EMPTY_LIST: 0x5d, LIST: 0x6c, APPEND: 0x61, APPENDS: 0x65,
  EMPTY_DICT: 0x7d, DICT: 0x64, SETITEM: 0x73, SETITEMS: 0x75,
  EMPTY_SET: 0x8f, ADDITEMS: 0x90, FROZENSET: 0x91,
  POP: 0x30, POP_MARK: 0x31, MARK: 0x28, DUP: 0x32,
  GLOBAL: 0x63, STACK_GLOBAL: 0x93, INST: 0x69,
  REDUCE: 0x52, BUILD: 0x62, NEWOBJ: 0x81, NEWOBJ_EX: 0x92, OBJ: 0x6f,
  PUT: 0x70, BINPUT: 0x71, LONG_BINPUT: 0x72, MEMOIZE: 0x94,
  GET: 0x67, BINGET: 0x68, LONG_BINGET: 0x6a,
  PERSID: 0x50, BINPERSID: 0x51,
} as const;

function pickleDecode(bytes: Uint8Array): unknown {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const stack: unknown[] = [];
  const memo: unknown[] = [];
  let proto = 0;

  const readU8 = () => view.getUint8(pos++);
  const readU16LE = () => { const v = view.getUint16(pos, true); pos += 2; return v; };
  const readU32LE = () => { const v = view.getUint32(pos, true); pos += 4; return v; };
  const readU64LE = () => { const v = view.getBigUint64(pos, true); pos += 8; return v; };
  const readI32LE = () => { const v = view.getInt32(pos, true); pos += 4; return v; };
  const readF64BE = () => { const v = view.getFloat64(pos, false); pos += 8; return v; };

  const readLine = (): string => {
    const start = pos;
    while (pos < bytes.length && bytes[pos] !== 0x0a) pos++;
    const s = utf8(bytes.subarray(start, pos));
    pos++;
    return s;
  };

  const readBigIntLE = (n: number): bigint => {
    let v = 0n;
    let mult = 1n;
    for (let i = 0; i < n; i++) { v += BigInt(view.getUint8(pos + i)) * mult; mult <<= 8n; }
    if (n > 0 && (view.getUint8(pos + n - 1) & 0x80) !== 0) v -= 1n << BigInt(n * 8);
    pos += n;
    return v;
  };

  const markIndex = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i] === MARK) return i;
    throw new Error('Pickle: no MARK on stack');
  };
  const popToMark = (): unknown[] => {
    const idx = markIndex();
    stack.splice(idx, 1);
    return stack.splice(idx);
  };

  while (pos < bytes.length) {
    const op = readU8();
    switch (op) {
      case OP.PROTO: proto = readU8(); break;
      case OP.FRAME: pos += 8; break;
      case OP.STOP: return stack.pop();
      case OP.NONE: stack.push(null); break;
      case OP.NEWTRUE: stack.push(true); break;
      case OP.NEWFALSE: stack.push(false); break;
      case OP.INT: stack.push(parsePyInt(readLine())); break;
      case OP.LONG: stack.push(parsePyInt(readLine())); break;
      case OP.BININT: stack.push(readI32LE()); break;
      case OP.BININT1: stack.push(readU8()); break;
      case OP.BININT2: stack.push(readU16LE()); break;
      case OP.LONG1: stack.push(bigintTag(readBigIntLE(readU8()))); break;
      case OP.LONG4: stack.push(bigintTag(readBigIntLE(readU32LE()))); break;
      case OP.FLOAT: stack.push(parseFloat(readLine())); break;
      case OP.BINFLOAT: stack.push(readF64BE()); break;
      case OP.STRING: stack.push(unescapePyString(readLine())); break;
      case OP.BINSTRING: { const l = readI32LE(); stack.push(utf8(bytes.subarray(pos, (pos += l)))); break; }
      case OP.SHORT_BINSTRING: { const l = readU8(); stack.push(utf8(bytes.subarray(pos, (pos += l)))); break; }
      case OP.BINUNICODE: { const l = readU32LE(); stack.push(utf8(bytes.subarray(pos, (pos += l)))); break; }
      case OP.SHORT_BINUNICODE: { const l = readU8(); stack.push(utf8(bytes.subarray(pos, (pos += l)))); break; }
      case OP.BINUNICODE8: { const l = Number(readU64LE()); stack.push(utf8(bytes.subarray(pos, (pos += l)))); break; }
      case OP.BINBYTES: { const l = readU32LE(); stack.push(bytesTag(bytes.subarray(pos, (pos += l)))); break; }
      case OP.SHORT_BINBYTES: { const l = readU8(); stack.push(bytesTag(bytes.subarray(pos, (pos += l)))); break; }
      case OP.BINBYTES8: { const l = Number(readU64LE()); stack.push(bytesTag(bytes.subarray(pos, (pos += l)))); break; }
      case OP.BYTEARRAY8: { const l = Number(readU64LE()); stack.push(bytesTag(bytes.subarray(pos, (pos += l)))); break; }
      case OP.EMPTY_TUPLE: stack.push({ __type: 'tuple', values: [] }); break;
      case OP.TUPLE: stack.push({ __type: 'tuple', values: popToMark() }); break;
      case OP.TUPLE1: stack.push({ __type: 'tuple', values: [stack.pop()] }); break;
      case OP.TUPLE2: { const b = stack.pop(), a = stack.pop(); stack.push({ __type: 'tuple', values: [a, b] }); break; }
      case OP.TUPLE3: { const c = stack.pop(), b = stack.pop(), a = stack.pop(); stack.push({ __type: 'tuple', values: [a, b, c] }); break; }
      case OP.EMPTY_LIST: stack.push([]); break;
      case OP.LIST: stack.push(popToMark()); break;
      case OP.APPEND: { const v = stack.pop(); const l = stack[stack.length - 1]; if (Array.isArray(l)) l.push(v); break; }
      case OP.APPENDS: { const items = popToMark(); const l = stack[stack.length - 1]; if (Array.isArray(l)) l.push(...items); break; }
      case OP.EMPTY_DICT: stack.push({}); break;
      case OP.DICT: { const items = popToMark(); const o: Record<string, unknown> = {}; for (let i = 0; i < items.length; i += 2) assignKey(o, items[i], items[i + 1]); stack.push(o); break; }
      case OP.SETITEM: { const v = stack.pop(), k = stack.pop(); const o = stack[stack.length - 1] as Record<string, unknown>; if (o && typeof o === 'object') assignKey(o, k, v); break; }
      case OP.SETITEMS: { const items = popToMark(); const o = stack[stack.length - 1] as Record<string, unknown>; for (let i = 0; i < items.length; i += 2) assignKey(o, items[i], items[i + 1]); break; }
      case OP.EMPTY_SET: stack.push({ __type: 'set', values: [] }); break;
      case OP.ADDITEMS: { const items = popToMark(); (stack[stack.length - 1] as { values: unknown[] }).values.push(...items); break; }
      case OP.FROZENSET: stack.push({ __type: 'frozenset', values: popToMark() }); break;
      case OP.POP: stack.pop(); break;
      case OP.POP_MARK: popToMark(); break;
      case OP.MARK: stack.push(MARK); break;
      case OP.DUP: stack.push(stack[stack.length - 1]); break;
      case OP.GLOBAL: { const mod = readLine(); const name = readLine(); stack.push({ __type: 'pickle:global', module: mod, name }); break; }
      case OP.STACK_GLOBAL: { const name = stack.pop(); const mod = stack.pop(); stack.push({ __type: 'pickle:global', module: String(mod), name: String(name) }); break; }
      case OP.INST: { const mod = readLine(); const name = readLine(); const args = popToMark(); stack.push({ __type: 'pickle:inst', module: mod, name, args }); break; }
      case OP.REDUCE: { const args = stack.pop(); const fn = stack.pop(); stack.push({ __type: 'pickle:reduce', callable: fn, args }); break; }
      case OP.BUILD: { const state = stack.pop(); applyBuild(stack[stack.length - 1], state); break; }
      case OP.NEWOBJ: { const args = stack.pop(); const cls = stack.pop(); stack.push(makeInstance(cls, args)); break; }
      case OP.NEWOBJ_EX: { const kw = stack.pop(); const args = stack.pop(); const cls = stack.pop(); stack.push(makeInstance(cls, args, kw)); break; }
      case OP.OBJ: stack.push({ __type: 'pickle:obj', args: popToMark() }); break;
      case OP.PUT: { memo[parseInt(readLine(), 10)] = stack[stack.length - 1]; break; }
      case OP.BINPUT: { memo[readU8()] = stack[stack.length - 1]; break; }
      case OP.LONG_BINPUT: { memo[readU32LE()] = stack[stack.length - 1]; break; }
      case OP.MEMOIZE: { memo[memo.length] = stack[stack.length - 1]; break; }
      case OP.GET: { stack.push(memo[parseInt(readLine(), 10)]); break; }
      case OP.BINGET: { stack.push(memo[readU8()]); break; }
      case OP.LONG_BINGET: { stack.push(memo[readU32LE()]); break; }
      case OP.PERSID: stack.push({ __type: 'pickle:persid', id: readLine() }); break;
      case OP.BINPERSID: stack.push({ __type: 'pickle:persid', id: stack.pop() }); break;
      default:
        throw new Error(`Pickle: unsupported opcode 0x${op.toString(16)} at pos ${pos - 1} (proto ${proto})`);
    }
  }
  throw new Error('Pickle: stream ended without STOP');
}

function bigintTag(v: bigint): { __type: 'bigint'; value: string } {
  return { __type: 'bigint', value: v.toString() };
}

function parsePyInt(s: string): unknown {
  s = s.trim();
  if (s === '00') return false;
  if (s === '01') return true;
  if (s.endsWith('L')) s = s.slice(0, -1);
  return bigintTag(BigInt(s));
}

function unescapePyString(s: string): string {
  s = s.trim();
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    s = s.slice(1, -1);
  }
  return s
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
    .replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function assignKey(o: Record<string, unknown>, k: unknown, v: unknown): void {
  if (typeof k === 'string') o[k] = v;
  else o[`<${String(k)}>`] = v;
}

function applyBuild(obj: unknown, state: unknown): void {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const o = obj as Record<string, unknown>;
    if (state && typeof state === 'object' && !Array.isArray(state)) {
      for (const [k, v] of Object.entries(state as Record<string, unknown>)) o[k] = v;
    } else {
      o.__state = state;
    }
  }
}

function makeInstance(cls: unknown, args: unknown, kw?: unknown): unknown {
  const out: Record<string, unknown> = { __type: 'pickle:instance', class: cls, args };
  if (kw !== undefined) out.kwargs = kw;
  return out;
}

/* ------------------------------------------------------------------ */
/* Java Object Serialization Stream decoder (best effort)             */
/* ------------------------------------------------------------------ */

const TC = {
  NULL: 0x70, REFERENCE: 0x71, CLASSDESC: 0x72, OBJECT: 0x73, STRING: 0x74,
  ARRAY: 0x75, CLASS: 0x76, BLOCKDATA: 0x77, ENDBLOCKDATA: 0x78, RESET: 0x79,
  BLOCKDATALONG: 0x7a, EXCEPTION: 0x7b, LONGSTRING: 0x7c, PROXYCLASSDESC: 0x7d, ENUM: 0x7e,
} as const;
const SC_WRITE_METHOD = 0x01, SC_SERIALIZABLE = 0x02, SC_EXTERNALIZABLE = 0x04;
const BASE_WIRE_HANDLE = 0x7e0000;
const PRIM_TYPES = new Set(['B', 'C', 'D', 'F', 'I', 'J', 'S', 'Z']);

interface JavaClassDesc {
  __type: 'java:class';
  name: string;
  serialVersionUID: string;
  flags: number;
  fields: { name: string; typecode: string; className?: string }[];
  superClass?: JavaClassDesc | null;
  annotations: unknown[];
}

function javaDecode(bytes: Uint8Array): unknown {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  let nextHandle = BASE_WIRE_HANDLE;
  const handles: unknown[] = [];

  const readU8 = () => view.getUint8(pos++);
  const readU16 = () => { const v = view.getUint16(pos, false); pos += 2; return v; };
  const readS32 = () => { const v = view.getInt32(pos, false); pos += 4; return v; };
  const readS64 = () => { const v = view.getBigInt64(pos, false).toString(); pos += 8; return v; };
  const readF32 = () => { const v = view.getFloat32(pos, false); pos += 4; return v; };
  const readF64 = () => { const v = view.getFloat64(pos, false); pos += 8; return v; };
  const newHandle = (obj: unknown) => { handles.push(obj); nextHandle++; return nextHandle - 1; };

  const readUtfBody = (len: number): string => javaUtfDecode(bytes.subarray(pos, (pos += len)));
  const readUtf = (): string => readUtfBody(readU16());
  const readLongString = (): string => readUtfBody(Number(readS64()));

  function readClassDesc(): JavaClassDesc | null {
    const tc = readU8();
    if (tc === TC.NULL) return null;
    if (tc === TC.REFERENCE) return handles[readS32() - BASE_WIRE_HANDLE] as JavaClassDesc;
    if (tc === TC.CLASSDESC) return readClassDescBody();
    if (tc === TC.PROXYCLASSDESC) return readProxyClassDesc();
    throw new Error(`Java: expected classDesc, got 0x${tc.toString(16)}`);
  }

  function readProxyClassDesc(): JavaClassDesc {
    const h = newHandle(undefined);
    const count = readS32();
    const ifaces: string[] = [];
    for (let i = 0; i < count; i++) ifaces.push(readUtf());
    const annotations = readObjectAnnotation();
    const superClass = readClassDesc();
    const cd: JavaClassDesc = { __type: 'java:class', name: '<proxy>', serialVersionUID: '0', flags: SC_SERIALIZABLE, fields: [], superClass, annotations };
    (cd as JavaClassDesc & { interfaces?: string[] }).interfaces = ifaces;
    handles[h - BASE_WIRE_HANDLE] = cd;
    return cd;
  }

  function readClassDescBody(): JavaClassDesc {
    const h = newHandle(undefined);
    const name = readUtf();
    const serialVersionUID = readS64();
    const flags = readU8();
    const fieldCount = readS32();
    const fields: { name: string; typecode: string; className?: string }[] = [];
    for (let i = 0; i < fieldCount; i++) {
      const typecode = String.fromCharCode(readU8());
      const fname = readUtf();
      let className: string | undefined;
      if ('[L'.includes(typecode)) {
        const tc2 = readU8();
        if (tc2 === TC.STRING) className = readUtf();
        else if (tc2 === TC.LONGSTRING) className = readLongString();
        else className = `<field-type 0x${tc2.toString(16)}>`;
      }
      fields.push({ name: fname, typecode, className });
    }
    const annotations = readObjectAnnotation();
    const superClass = readClassDesc();
    const cd: JavaClassDesc = { __type: 'java:class', name, serialVersionUID, flags, fields, superClass, annotations };
    handles[h - BASE_WIRE_HANDLE] = cd;
    return cd;
  }

  function readObjectAnnotation(): unknown[] {
    const blocks: unknown[] = [];
    while (true) {
      const tc = view.getUint8(pos);
      if (tc === TC.ENDBLOCKDATA) { pos++; break; }
      if (tc === TC.BLOCKDATA) { pos++; const len = readU8(); blocks.push(bytesTag(bytes.subarray(pos, (pos += len)))); continue; }
      if (tc === TC.BLOCKDATALONG) { pos++; const len = readS32(); blocks.push(bytesTag(bytes.subarray(pos, (pos += len)))); continue; }
      blocks.push(readContent());
    }
    return blocks;
  }

  function readContent(): unknown {
    const tc = readU8();
    switch (tc) {
      case TC.NULL: return null;
      case TC.REFERENCE: { const h = readS32() - BASE_WIRE_HANDLE; return { __type: 'java:ref', handle: h + BASE_WIRE_HANDLE }; }
      case TC.STRING: { const s = readUtf(); newHandle(s); return s; }
      case TC.LONGSTRING: { const s = readLongString(); newHandle(s); return s; }
      case TC.BLOCKDATA: { const len = readU8(); return bytesTag(bytes.subarray(pos, (pos += len))); }
      case TC.BLOCKDATALONG: { const len = readS32(); return bytesTag(bytes.subarray(pos, (pos += len))); }
      case TC.ENUM: { const h = newHandle(undefined); const cd = readClassDesc(); const name = readContent(); const r = { __type: 'java:enum', class: cd, constant: name }; handles[h - BASE_WIRE_HANDLE] = r; return r; }
      case TC.OBJECT: return readNewObject();
      case TC.ARRAY: return readNewArray();
      case TC.CLASS: { const cd = readClassDesc(); newHandle(cd); return { __type: 'java:classref', class: cd }; }
      case TC.RESET: nextHandle = BASE_WIRE_HANDLE; return readContent();
      default: throw new Error(`Java: unsupported tag 0x${tc.toString(16)} at pos ${pos - 1}`);
    }
  }

  function readNewObject(): unknown {
    const h = newHandle(undefined);
    const cd = readClassDesc();
    if (!cd) throw new Error('Java: object without class descriptor');
    const chain: JavaClassDesc[] = [];
    for (let c: JavaClassDesc | null | undefined = cd; c; c = c.superClass) chain.unshift(c);
    const obj: Record<string, unknown> = { __type: 'java:object', class: cd.name };
    handles[h - BASE_WIRE_HANDLE] = obj;
    for (const cls of chain) {
      if (!(cls.flags & SC_SERIALIZABLE)) {
        if (cls.flags & SC_EXTERNALIZABLE) obj[cls.name + '#external'] = readObjectAnnotation();
        continue;
      }
      const fieldValues: Record<string, unknown> = {};
      for (const f of cls.fields) fieldValues[f.name] = readFieldValue(f);
      if (cls.fields.length > 0) obj[cls.name + '#fields'] = fieldValues;
      if (cls.flags & SC_WRITE_METHOD) obj[cls.name + '#writeObject'] = readObjectAnnotation();
    }
    handles[h - BASE_WIRE_HANDLE] = obj;
    return obj;
  }

  function readFieldValue(f: { name: string; typecode: string }): unknown {
    switch (f.typecode) {
      case 'B': return readU8();
      case 'C': return readU16();
      case 'D': return readF64();
      case 'F': return readF32();
      case 'I': return readS32();
      case 'J': return readS64();
      case 'S': return readS32() & 0xffff;
      case 'Z': return readU8() !== 0;
      case '[':
      case 'L': return readContent();
      default: return null;
    }
  }

  function readNewArray(): unknown {
    const h = newHandle(undefined);
    const cd = readClassDesc();
    if (!cd) throw new Error('Java: array without class descriptor');
    const len = readS32();
    const arr: unknown[] = [];
    handles[h - BASE_WIRE_HANDLE] = arr;
    const comp = (cd.name || '').replace(/^\[+/, '');
    const isPrimitive = PRIM_TYPES.has(comp);
    for (let i = 0; i < len; i++) arr.push(isPrimitive ? readPrimitive(comp) : readContent());
    handles[h - BASE_WIRE_HANDLE] = arr;
    return { __type: 'java:array', componentType: cd.name, length: len, values: arr };
  }

  function readPrimitive(c: string): unknown {
    switch (c) {
      case 'B': return readU8();
      case 'C': return readU16();
      case 'D': return readF64();
      case 'F': return readF32();
      case 'I': return readS32();
      case 'J': return readS64();
      case 'S': return readS32() & 0xffff;
      case 'Z': return readU8() !== 0;
      default: return null;
    }
  }

  const magic = readU16();
  const version = readU16();
  if (magic !== 0xaced) throw new Error(`Java: bad magic 0x${magic.toString(16)} (expected 0xACED)`);
  if (version !== 5) throw new Error(`Java: unsupported stream version ${version}`);
  return readContent();
}

function javaUtfDecode(bytes: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < bytes.length) {
    const a = bytes[i++];
    if (a < 0x80) { s += String.fromCharCode(a); continue; }
    const b = bytes[i++];
    if ((a & 0xe0) === 0xc0) { s += String.fromCharCode(((a & 0x1f) << 6) | (b & 0x3f)); continue; }
    const c = bytes[i++];
    if ((a & 0xf0) === 0xe0) {
      const cp = ((a & 0x0f) << 12) | ((b & 0x3f) << 6) | (c & 0x3f);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < bytes.length) {
        const d = bytes[i++], e = bytes[i++];
        const low = ((d & 0x0f) << 12) | ((e & 0x3f) << 6);
        s += String.fromCodePoint(0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00));
      } else {
        s += String.fromCodePoint(cp);
      }
      continue;
    }
    s += '\uFFFD';
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Property List (XML + ASCII + binary) decoder                        */
/* ------------------------------------------------------------------ */

function plistDecode(bytes: Uint8Array): unknown {
  if (bytes.length >= 8 && utf8(bytes.subarray(0, 8)) === 'bplist00') return bplistDecode(bytes);
  const text = utf8(bytes).trim();
  if (text.startsWith('<?xml') || text.startsWith('<!DOCTYPE plist') || text.startsWith('<plist')) {
    return xmlPlistDecode(text);
  }
  return asciiPlistDecode(text);
}

function xmlPlistDecode(text: string): unknown {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Plist: malformed XML');
  const root = doc.querySelector('plist > *');
  if (!root) throw new Error('Plist: empty plist');
  return parseXmlNode(root);
}

function parseXmlNode(node: Element): unknown {
  switch (node.tagName) {
    case 'dict': {
      const o: Record<string, unknown> = {};
      const kids = Array.from(node.children);
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].tagName === 'key') {
          const key = kids[i].textContent ?? '';
          o[key] = kids[i + 1] ? parseXmlNode(kids[i + 1]) : null;
          i++;
        }
      }
      return o;
    }
    case 'array': return Array.from(node.children).map(parseXmlNode);
    case 'string': return node.textContent ?? '';
    case 'integer': return parseInt((node.textContent ?? '0').trim(), 10);
    case 'real': return parseFloat((node.textContent ?? '0').trim());
    case 'true': return true;
    case 'false': return false;
    case 'date': return { __type: 'date', iso: node.textContent ?? '' };
    case 'data': return bytesTag(base64ToBytes((node.textContent ?? '').replace(/\s+/g, '')));
    default: return node.textContent ?? null;
  }
}

class AsciiPlistParser {
  i = 0;
  s: string;
  constructor(s: string) { this.s = s; }
  skip(): void {
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i];
      if (!/\s/.test(c)) {
        if (c === '/' && this.s[this.i + 1] === '/') { while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++; continue; }
        return;
      }
    }
  }
  parseValue(): unknown {
    this.skip();
    const c = this.s[this.i];
    if (c === '{') return this.parseDict();
    if (c === '(') return this.parseArray();
    if (c === '"' || c === "'") return this.parseQuoted(c);
    return this.parseToken();
  }
  parseDict(): Record<string, unknown> {
    this.i++; this.skip();
    const o: Record<string, unknown> = {};
    while (this.s[this.i] && this.s[this.i] !== '}') {
      const key = this.parseValue();
      this.skip();
      if (this.s[this.i] === '=') { this.i++; this.skip(); }
      const val = this.parseValue();
      o[String(key)] = val;
      this.skip();
      if (this.s[this.i] === ';' || this.s[this.i] === ',') { this.i++; this.skip(); }
    }
    this.i++;
    return o;
  }
  parseArray(): unknown[] {
    this.i++; this.skip();
    const arr: unknown[] = [];
    while (this.s[this.i] && this.s[this.i] !== ')') {
      arr.push(this.parseValue());
      this.skip();
      if (this.s[this.i] === ',' || this.s[this.i] === ';') { this.i++; this.skip(); }
    }
    this.i++;
    return arr;
  }
  parseQuoted(q: string): string {
    this.i++;
    let out = '';
    while (this.s[this.i] && this.s[this.i] !== q) {
      if (this.s[this.i] === '\\') { out += this.s[this.i + 1] ?? ''; this.i += 2; }
      else out += this.s[this.i++];
    }
    this.i++;
    return out;
  }
  parseToken(): string {
    let out = '';
    while (this.s[this.i] && !/[\s{}();,=]/.test(this.s[this.i])) out += this.s[this.i++];
    return out;
  }
}

function asciiPlistDecode(text: string): unknown {
  return new AsciiPlistParser(text).parseValue();
}

/* Binary plist (bplist00) */
function bplistDecode(bytes: Uint8Array): unknown {
  if (bytes.length < 32) throw new Error('bplist: too short for trailer');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const trailer = bytes.length - 32;
  const offsetIntSize = view.getUint8(trailer + 6);
  const objectRefSize = view.getUint8(trailer + 7);
  const numObjects = Number(view.getBigUint64(trailer + 8, false));
  const topObject = Number(view.getBigUint64(trailer + 16, false));
  const offsetTableOffset = Number(view.getBigUint64(trailer + 24, false));

  // Validate the trailer-derived sizes/counts so a malformed bplist can't drive
  // disproportionate allocation or out-of-range reads before failing.
  if (offsetIntSize < 1 || offsetIntSize > 8) throw new Error('bplist: invalid offsetIntSize');
  if (objectRefSize < 1 || objectRefSize > 8) throw new Error('bplist: invalid objectRefSize');
  if (!Number.isInteger(numObjects) || numObjects < 0 || numObjects > bytes.length) {
    throw new Error('bplist: invalid numObjects');
  }
  if (!Number.isInteger(offsetTableOffset) || offsetTableOffset < 0 || offsetTableOffset > bytes.length) {
    throw new Error('bplist: invalid offsetTableOffset');
  }
  if (!Number.isInteger(topObject) || topObject < 0 || topObject >= numObjects) {
    throw new Error('bplist: invalid topObject');
  }

  const readSizedInt = (off: number, size: number): number => {
    if (off < 0 || off + size > bytes.length) throw new Error('bplist: read out of range');
    let n = 0;
    for (let j = 0; j < size; j++) n = n * 256 + view.getUint8(off + j);
    return n;
  };

  const offsets: number[] = [];
  for (let i = 0; i < numObjects; i++) offsets.push(readSizedInt(offsetTableOffset + i * offsetIntSize, offsetIntSize));

  // returns { count, dataStart } for an object at off with low nibble nib
  const readCount = (off: number, nib: number): { count: number; dataStart: number } => {
    if (nib !== 0x0f) return { count: nib, dataStart: off + 1 };
    const ext = view.getUint8(off + 1);
    const size = 1 << (ext & 0x0f);
    return { count: readSizedInt(off + 2, size), dataStart: off + 2 + size };
  };

  // Cycle protection via a single shared visited set (indices are unique), so
  // nested structures stay O(n) instead of copying the set on every recursion.
  const seen = new Set<number>();
  function parseObj(idx: number): unknown {
    if (seen.has(idx)) return { __type: 'circular' };
    seen.add(idx);
    const off = offsets[idx];
    const header = view.getUint8(off);
    const nib = header & 0x0f;
    switch (header & 0xf0) {
      case 0x00: // null / false / true
        if (nib === 0x08) return false;
        if (nib === 0x09) return true;
        return null;
      case 0x10: { // int
        const size = 1 << nib;
        let n = 0n;
        for (let j = 0; j < size; j++) n = (n << 8n) | BigInt(view.getUint8(off + 1 + j));
        if (n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= BigInt(Number.MIN_SAFE_INTEGER)) return Number(n);
        return { __type: 'bigint', value: n.toString() };
      }
      case 0x20: // real
        return nib === 2 ? view.getFloat32(off + 1, false) : view.getFloat64(off + 1, false);
      case 0x30: // date (8-byte float, seconds since 2001-01-01)
        return { __type: 'date', value: view.getFloat64(off + 1, false), iso: new Date(view.getFloat64(off + 1, false) * 1000 + 978307200000).toISOString() };
      case 0x40: { // data
        const { count, dataStart } = readCount(off, nib);
        return bytesTag(bytes.subarray(dataStart, dataStart + count));
      }
      case 0x50: { // ascii string
        const { count, dataStart } = readCount(off, nib);
        return utf8(bytes.subarray(dataStart, dataStart + count));
      }
      case 0x60: { // utf16 string
        const { count, dataStart } = readCount(off, nib);
        let s = '';
        for (let j = 0; j < count; j++) s += String.fromCharCode(view.getUint16(dataStart + j * 2, false));
        return s;
      }
      case 0x70: { // uid
        const size = nib + 1;
        let n = 0;
        for (let j = 0; j < size; j++) n = n * 256 + view.getUint8(off + 1 + j);
        return { __type: 'uid', value: n };
      }
      case 0x90: { // array
        const { count, dataStart } = readCount(off, nib);
        const arr: unknown[] = [];
        for (let j = 0; j < count; j++) {
          const ref = readSizedInt(dataStart + j * objectRefSize, objectRefSize);
          arr.push(parseObj(ref));
        }
        return arr;
      }
      case 0xa0: { // set (non-standard, best effort)
        const { count, dataStart } = readCount(off, nib);
        const values: unknown[] = [];
        for (let j = 0; j < count; j++) {
          const ref = readSizedInt(dataStart + j * objectRefSize, objectRefSize);
          values.push(parseObj(ref));
        }
        return { __type: 'set', values };
      }
      case 0xd0: { // dict
        const { count, dataStart } = readCount(off, nib);
        const o: Record<string, unknown> = {};
        for (let j = 0; j < count; j++) {
          const kref = readSizedInt(dataStart + j * objectRefSize, objectRefSize);
          const vref = readSizedInt(dataStart + (count + j) * objectRefSize, objectRefSize);
          o[String(parseObj(kref))] = parseObj(vref);
        }
        return o;
      }
      default:
        throw new Error(`bplist: unknown object type 0x${header.toString(16)} at ${off}`);
    }
  }

  return parseObj(topObject);
}
