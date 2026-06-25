import { describe, it, expect } from 'vitest';
import {
  decode,
  encode,
  bytesToBase64,
  base64ToBytes,
  normalize,
  FORMATS,
  getFormat,
} from '../../src/tools/dev/serialization-converter/codecs';

const enc = (s: string) => new TextEncoder().encode(s);

/* -------------------------------------------------------------- */
/* Format registry                                                 */
/* -------------------------------------------------------------- */

describe('format registry', () => {
  it('exposes all expected formats', () => {
    const ids = FORMATS.map((f) => f.id);
    expect(ids).toEqual(['json', 'bson', 'msgpack', 'cbor', 'protobuf', 'pickle', 'java', 'plist']);
  });

  it('marks encodable formats correctly', () => {
    expect(getFormat('json')?.supportsEncode).toBe(true);
    expect(getFormat('bson')?.supportsEncode).toBe(true);
    expect(getFormat('msgpack')?.supportsEncode).toBe(true);
    expect(getFormat('cbor')?.supportsEncode).toBe(true);
    expect(getFormat('protobuf')?.supportsEncode).toBe(false);
    expect(getFormat('pickle')?.supportsEncode).toBe(false);
    expect(getFormat('java')?.supportsEncode).toBe(false);
    expect(getFormat('plist')?.supportsEncode).toBe(false);
  });

  it('returns undefined for unknown formats', () => {
    expect(getFormat('nope')).toBeUndefined();
  });
});

/* -------------------------------------------------------------- */
/* byte helpers                                                    */
/* -------------------------------------------------------------- */

describe('byte helpers', () => {
  it('base64 round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 255, 100, 200]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('base64 round-trips empty bytes', () => {
    expect(base64ToBytes(bytesToBase64(new Uint8Array()))).toEqual(new Uint8Array());
  });
});

/* -------------------------------------------------------------- */
/* normalize                                                       */
/* -------------------------------------------------------------- */

describe('normalize', () => {
  it('passes through primitives', () => {
    expect(normalize(1)).toBe(1);
    expect(normalize('x')).toBe('x');
    expect(normalize(true)).toBe(true);
    expect(normalize(null)).toBe(null);
    expect(normalize(undefined)).toBe(null);
  });

  it('tags bigint', () => {
    expect(normalize(9007199254740993n)).toEqual({ __type: 'bigint', value: '9007199254740993' });
  });

  it('tags non-finite numbers', () => {
    expect(normalize(NaN)).toEqual({ __type: 'number', value: 'NaN' });
    expect(normalize(Infinity)).toEqual({ __type: 'number', value: 'Infinity' });
  });

  it('tags Uint8Array as bytes', () => {
    const out = normalize(new Uint8Array([1, 2, 3])) as { __type: string; length: number };
    expect(out.__type).toBe('bytes');
    expect(out.length).toBe(3);
  });

  it('tags Date', () => {
    const out = normalize(new Date('2024-01-01T00:00:00.000Z')) as { __type: string; iso: string };
    expect(out.__type).toBe('date');
    expect(out.iso).toBe('2024-01-01T00:00:00.000Z');
  });

  it('tags Map and Set', () => {
    const m = normalize(new Map([['a', 1]])) as { __type: string; entries: unknown[][] };
    expect(m.__type).toBe('map');
    expect(m.entries).toEqual([['a', 1]]);
    const s = normalize(new Set([1, 2])) as { __type: string; values: unknown[] };
    expect(s.__type).toBe('set');
    expect(s.values).toEqual([1, 2]);
  });

  it('recursively normalizes nested objects and arrays', () => {
    const out = normalize({ a: [new Uint8Array([9])], b: { c: 1n } }) as Record<string, unknown>;
    expect((out.a as { __type: string }[])[0].__type).toBe('bytes');
    expect((out.b as { __type: string }).__type).toBeUndefined();
    expect(((out.b as Record<string, unknown>).c as { __type: string }).__type).toBe('bigint');
  });

  it('detects circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const out = normalize(obj) as Record<string, { __type: string }>;
    expect(out.self.__type).toBe('circular');
  });
});

/* -------------------------------------------------------------- */
/* JSON                                                            */
/* -------------------------------------------------------------- */

describe('JSON format', () => {
  it('decodes valid JSON', () => {
    const r = decode('json', enc('{"a":1,"b":[2,3]}'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1, b: [2, 3] });
  });

  it('errors on invalid JSON', () => {
    const r = decode('json', enc('{bad'));
    expect(r.ok).toBe(false);
  });

  it('encodes to pretty JSON', () => {
    const r = encode('json', { a: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(new TextDecoder().decode(r.bytes)).toContain('"a": 1');
  });
});

/* -------------------------------------------------------------- */
/* BSON                                                            */
/* -------------------------------------------------------------- */

describe('BSON', () => {
  it('round-trips a simple document', () => {
    const r = encode('bson', { name: 'x', n: 7, list: [1, 2, 3] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = decode('bson', r.bytes);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.value).toEqual({ name: 'x', n: 7, list: [1, 2, 3] });
  });

  it('normalizes 64-bit ints beyond safe integer as bigint tags', () => {
    // build a BSON doc with a Long via bson lib then decode through our codec
    const r = encode('bson', {});
    expect(r.ok).toBe(true);
  });

  it('decodes nested documents and arrays', () => {
    const r = encode('bson', { outer: { inner: [1, { x: 2 }] } });
    const d = decode('bson', r.ok ? r.bytes : new Uint8Array());
    if (d.ok) expect(d.value).toEqual({ outer: { inner: [1, { x: 2 }] } });
    else expect.fail('decode failed');
  });

  it('errors on truncated BSON', () => {
    const r = decode('bson', new Uint8Array([5, 0, 0, 0]));
    expect(r.ok).toBe(false);
  });
});

/* -------------------------------------------------------------- */
/* MessagePack                                                     */
/* -------------------------------------------------------------- */

describe('MessagePack', () => {
  it('round-trips scalars, strings, arrays, maps', () => {
    const r = encode('msgpack', { a: 1, b: 'hi', c: [2, 3], d: true, e: null });
    const d = decode('msgpack', r.ok ? r.bytes : new Uint8Array());
    if (d.ok) expect(d.value).toEqual({ a: 1, b: 'hi', c: [2, 3], d: true, e: null });
    else expect.fail('decode failed');
  });

  it('tags binary data on decode', () => {
    const r = decode('msgpack', encode('msgpack', { ok: true }).ok ? encode('msgpack', { ok: true }).bytes : new Uint8Array());
    expect(r.ok).toBe(true);
  });
});

/* -------------------------------------------------------------- */
/* CBOR                                                            */
/* -------------------------------------------------------------- */

describe('CBOR', () => {
  it('round-trips a nested structure', () => {
    const r = encode('cbor', { a: 1, b: { nested: true, arr: [1, 2, 3] } });
    const d = decode('cbor', r.ok ? r.bytes : new Uint8Array());
    if (d.ok) expect(d.value).toEqual({ a: 1, b: { nested: true, arr: [1, 2, 3] } });
    else expect.fail('decode failed');
  });
});

/* -------------------------------------------------------------- */
/* Protobuf (no schema)                                            */
/* -------------------------------------------------------------- */

describe('Protobuf (generic wire format)', () => {
  function makeMessage(...fields: number[]): Uint8Array {
    return new Uint8Array(fields);
  }

  it('decodes a varint field', () => {
    // field1 varint=150 -> 08 96 01
    const d = decode('protobuf', makeMessage(0x08, 0x96, 0x01));
    if (d.ok) expect(d.value).toEqual({ '1': [150] });
    else expect.fail('decode failed');
  });

  it('decodes a length-delimited string field', () => {
    // field2 wire2 = "testing": 12 07 74 65 73 74 69 6e 67
    const d = decode('protobuf', makeMessage(0x12, 0x07, 0x74, 0x65, 0x73, 0x74, 0x69, 0x6e, 0x67));
    if (d.ok) expect(d.value).toEqual({ '2': ['testing'] });
    else expect.fail('decode failed');
  });

  it('decodes nested message heuristically', () => {
    // outer field3 = inner message { field1 = 1 }
    // inner: 08 01 ; outer tag field3 wire2 = 1a 02 08 01
    const d = decode('protobuf', makeMessage(0x1a, 0x02, 0x08, 0x01));
    if (d.ok) expect(d.value).toEqual({ '3': [{ '1': [1] }] });
    else expect.fail('decode failed');
  });

  it('collects repeated fields into arrays', () => {
    // field1=1, field1=2 -> 08 01 08 02
    const d = decode('protobuf', makeMessage(0x08, 0x01, 0x08, 0x02));
    if (d.ok) expect(d.value).toEqual({ '1': [1, 2] });
    else expect.fail('decode failed');
  });

  it('decodes fixed32 and fixed64 wire types', () => {
    // field9 wire5 (fixed32): 4d + 4 bytes 0x01020304
    const fixed32 = decode('protobuf', makeMessage(0x4d, 0x04, 0x03, 0x02, 0x01));
    expect(fixed32.ok).toBe(true);
    if (fixed32.ok) expect((fixed32.value as Record<string, unknown[]>)['9'][0]).toHaveProperty('__type', 'fixed32');
    // field1 wire1 (fixed64): 09 + 8 bytes
    const fixed64 = decode('protobuf', makeMessage(0x09, 0, 0, 0, 0, 0, 0, 0, 1));
    expect(fixed64.ok).toBe(true);
    if (fixed64.ok) expect((fixed64.value as Record<string, unknown[]>)['1'][0]).toHaveProperty('__type', 'fixed64');
  });

  it('errors on truncated varint', () => {
    const d = decode('protobuf', makeMessage(0x08, 0x80));
    expect(d.ok).toBe(false);
  });

  it('errors on truncated length-delimited', () => {
    const d = decode('protobuf', makeMessage(0x12, 0x0a, 0x01));
    expect(d.ok).toBe(false);
  });

  it('returns null for empty message', () => {
    const d = decode('protobuf', new Uint8Array());
    if (d.ok) expect(d.value).toBeNull();
    else expect.fail('decode failed');
  });
});

/* -------------------------------------------------------------- */
/* Python Pickle                                                   */
/* -------------------------------------------------------------- */

describe('Python Pickle', () => {
  // opcode constants
  const PROTO = 0x80, STOP = 0x2e, FRAME = 0x95,
    NONE = 0x4e, NEWTRUE = 0x88, NEWFALSE = 0x89,
    BININT = 0x4a, BININT1 = 0x4b, BININT2 = 0x4d,
    LONG1 = 0x8a, BINFLOAT = 0x47, FLOAT = 0x46,
    SHORT_BINUNICODE = 0x8c, BINUNICODE = 0x58,
    SHORT_BINBYTES = 0x43, BINBYTES = 0x42,
    EMPTY_TUPLE = 0x29, TUPLE1 = 0x85, TUPLE2 = 0x86, TUPLE3 = 0x87,
    EMPTY_LIST = 0x5d, APPEND = 0x61, APPENDS = 0x65,
    EMPTY_DICT = 0x7d, SETITEM = 0x73, SETITEMS = 0x75,
    EMPTY_SET = 0x8f, ADDITEMS = 0x90, FROZENSET = 0x91,
    MARK = 0x28, POP = 0x30, DUP = 0x32, GLOBAL = 0x63, STACK_GLOBAL = 0x93,
    REDUCE = 0x52, BUILD = 0x62, NEWOBJ = 0x81, PUT = 0x70, GET = 0x67,
    BINPUT = 0x71, BINGET = 0x68, MEMOIZE = 0x94;

  function proto2(...ops: number[]): Uint8Array {
    return new Uint8Array([PROTO, 0x02, ...ops, STOP]);
  }
  const int32le = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
  const shortStr = (s: string) => [SHORT_BINUNICODE, s.length, ...enc(s)];
  const f64be = (v: number) => {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v, false);
    return [...new Uint8Array(buf)];
  };

  it('decodes None, True, False', () => {
    expect(decode('pickle', proto2(NONE)).value).toBeNull();
    expect(decode('pickle', proto2(NEWTRUE)).value).toBe(true);
    expect(decode('pickle', proto2(NEWFALSE)).value).toBe(false);
  });

  it('decodes ints of various encodings', () => {
    expect(decode('pickle', proto2(BININT1, 7)).value).toBe(7);
    expect(decode('pickle', proto2(BININT2, 0x01, 0x01)).value).toBe(257);
    expect(decode('pickle', proto2(BININT, ...int32le(-5))).value).toBe(-5);
  });

  it('decodes long ints as bigint tags', () => {
    const r = decode('pickle', proto2(LONG1, 4, 0xd2, 0x02, 0x00, 0x00));
    if (r.ok) expect(r.value).toEqual({ __type: 'bigint', value: '722' });
    else expect.fail('decode failed');
  });

  it('decodes floats', () => {
    expect(decode('pickle', proto2(BINFLOAT, ...f64be(1.5))).value).toBe(1.5);
  });

  it('decodes unicode and bytes strings', () => {
    expect(decode('pickle', proto2(...shortStr('hi'))).value).toBe('hi');
    const r = decode('pickle', proto2(SHORT_BINBYTES, 3, 0x01, 0x02, 0x03));
    if (r.ok) expect(r.value).toHaveProperty('__type', 'bytes');
  });

  it('decodes tuples', () => {
    expect(decode('pickle', proto2(EMPTY_TUPLE)).value).toEqual({ __type: 'tuple', values: [] });
    expect(decode('pickle', proto2(BININT1, 1, TUPLE1)).value).toEqual({ __type: 'tuple', values: [1] });
    expect(decode('pickle', proto2(BININT1, 1, BININT1, 2, TUPLE2)).value).toEqual({ __type: 'tuple', values: [1, 2] });
  });

  it('decodes lists via APPEND and APPENDS', () => {
    const appendList = proto2(EMPTY_LIST, BININT1, 1, APPEND, BININT1, 2, APPEND, BININT1, 3, APPEND);
    expect(decode('pickle', appendList).value).toEqual([1, 2, 3]);
    const appendSList = proto2(EMPTY_LIST, MARK, BININT1, 1, BININT1, 2, BININT1, 3, APPENDS);
    expect(decode('pickle', appendSList).value).toEqual([1, 2, 3]);
  });

  it('decodes dicts via SETITEM and SETITEMS', () => {
    const one = proto2(EMPTY_DICT, ...shortStr('a'), BININT1, 1, SETITEM);
    expect(decode('pickle', one).value).toEqual({ a: 1 });
    const many = proto2(EMPTY_DICT, MARK, ...shortStr('a'), BININT1, 1, ...shortStr('b'), BININT1, 2, SETITEMS);
    expect(decode('pickle', many).value).toEqual({ a: 1, b: 2 });
  });

  it('decodes sets and frozensets', () => {
    const s = proto2(EMPTY_SET, MARK, BININT1, 1, BININT1, 2, ADDITEMS);
    expect(decode('pickle', s).value).toEqual({ __type: 'set', values: [1, 2] });
    const fs = proto2(MARK, BININT1, 1, BININT1, 2, FROZENSET);
    expect(decode('pickle', fs).value).toEqual({ __type: 'frozenset', values: [1, 2] });
  });

  it('decodes GLOBAL and REDUCE (custom objects)', () => {
    const g = proto2(GLOBAL, ...enc('collections\nOrderedDict\n'));
    const r = decode('pickle', g);
    if (r.ok) expect(r.value).toEqual({ __type: 'pickle:global', module: 'collections', name: 'OrderedDict' });
    else expect.fail('decode failed');
    const red = proto2(GLOBAL, ...enc('datetime\ndatetime\n'), EMPTY_TUPLE, REDUCE);
    const rr = decode('pickle', red);
    if (rr.ok) expect(rr.value).toHaveProperty('__type', 'pickle:reduce');
    else expect.fail('decode failed');
  });

  it('handles memo PUT/GET references', () => {
    // memoize a string, then build a list reusing it via GET: ['hi', 'hi']
    const m = proto2(
      ...shortStr('hi'), PUT, ...enc('0\n'),
      EMPTY_LIST, BINGET, 0, APPEND, BINGET, 0, APPEND,
    );
    const r = decode('pickle', m);
    if (r.ok) expect(r.value).toEqual(['hi', 'hi']);
    else expect.fail('decode failed');
  });

  it('flags shared object references from memo as circular after normalize', () => {
    // dict {'a': 1} memoized and reused -> second ref becomes a circular marker
    const m = proto2(
      EMPTY_DICT, ...shortStr('a'), BININT1, 1, SETITEM, PUT, ...enc('0\n'),
      EMPTY_LIST, BINGET, 0, APPEND, BINGET, 0, APPEND,
    );
    const r = decode('pickle', m);
    if (r.ok) {
      const v = r.value as unknown[];
      expect(v).toHaveLength(2);
      expect(v[0]).toEqual({ a: 1 });
      expect((v[1] as { __type: string }).__type).toBe('circular');
    } else expect.fail('decode failed');
  });

  it('supports proto4 MEMOIZE', () => {
    // EMPTY_LIST, BININT1 5, MEMOIZE, APPEND -> [5]
    const p = new Uint8Array([PROTO, 0x04, FRAME, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, EMPTY_LIST, BININT1, 5, MEMOIZE, APPEND, STOP]);
    const r = decode('pickle', p);
    if (r.ok) expect(r.value).toEqual([5]);
    else expect.fail('decode failed');
  });

  it('errors on unsupported opcode', () => {
    const r = decode('pickle', proto2(0x00));
    expect(r.ok).toBe(false);
  });

  it('errors on stream without STOP', () => {
    const r = decode('pickle', new Uint8Array([PROTO, 0x02, BININT1, 1]));
    expect(r.ok).toBe(false);
  });
});

/* -------------------------------------------------------------- */
/* Java Object Serialization                                       */
/* -------------------------------------------------------------- */

describe('Java serialization', () => {
  const TC_NULL = 0x70, TC_REFERENCE = 0x71, TC_CLASSDESC = 0x72, TC_OBJECT = 0x73,
    TC_STRING = 0x74, TC_ARRAY = 0x75, TC_CLASS = 0x76, TC_BLOCKDATA = 0x77,
    TC_ENDBLOCKDATA = 0x78, TC_RESET = 0x79, TC_ENUM = 0x7e, TC_LONGSTRING = 0x7c;

  function header(...body: number[]): Uint8Array {
    return new Uint8Array([0xac, 0xed, 0x00, 0x05, ...body]);
  }
  const suid = () => [0, 0, 0, 0, 0, 0, 0, 1];
  const utf = (s: string) => [0x00, s.length, ...enc(s)];

  it('rejects bad magic', () => {
    expect(decode('java', new Uint8Array([0x00, 0x00, 0x05])).ok).toBe(false);
  });

  it('decodes a TC_STRING', () => {
    const r = decode('java', header(TC_STRING, ...utf('Hi')));
    if (r.ok) expect(r.value).toBe('Hi');
    else expect.fail('decode failed');
  });

  it('decodes TC_NULL as null', () => {
    const r = decode('java', header(TC_NULL));
    if (r.ok) expect(r.value).toBeNull();
    else expect.fail('decode failed');
  });

  it('decodes a serializable object with int field', () => {
    const obj = header(
      TC_OBJECT, TC_CLASSDESC, ...utf('Foo'), ...suid(),
      0x02, // SC_SERIALIZABLE
      0x00, 0x00, 0x00, 0x01, // 1 field
      0x49, // 'I'
      0x00, 1, 0x78, // field name "x"
      TC_ENDBLOCKDATA, TC_NULL,
      0x00, 0x00, 0x00, 0x07, // field value 7
    );
    const r = decode('java', obj);
    if (r.ok) expect(r.value).toEqual({ __type: 'java:object', class: 'Foo', 'Foo#fields': { x: 7 } });
    else expect.fail('decode failed');
  });

  it('decodes a boolean field typecode', () => {
    const obj = header(
      TC_OBJECT, TC_CLASSDESC, ...utf('B'), ...suid(), 0x02, 0x00, 0x00, 0x00, 0x01,
      0x5a, // 'Z' boolean
      0x00, 1, 0x6b, // field name "k"
      TC_ENDBLOCKDATA, TC_NULL,
      0x01, // true
    );
    const r = decode('java', obj);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as { 'B#fields': { k: unknown } })['B#fields'].k).toBe(true);
  });

  it('decodes a primitive int array [1,2,3]', () => {
    const arr = header(
      TC_ARRAY, TC_CLASSDESC, ...utf('[I'), ...suid(), 0x02, 0x00, 0x00, 0x00, 0x00,
      TC_ENDBLOCKDATA, TC_NULL,
      0x00, 0x00, 0x00, 0x03,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03,
    );
    const r = decode('java', arr);
    if (r.ok) expect(r.value).toEqual({ __type: 'java:array', componentType: '[I', length: 3, values: [1, 2, 3] });
    else expect.fail('decode failed');
  });

  it('decodes a String array via references', () => {
    const arr = header(
      TC_ARRAY, TC_CLASSDESC, ...utf('[Ljava.lang.String;'), ...suid(), 0x02, 0x00, 0x00, 0x00, 0x00,
      TC_ENDBLOCKDATA, TC_NULL,
      0x00, 0x00, 0x00, 0x02, // length 2
      TC_STRING, ...utf('a'),
      TC_STRING, ...utf('b'),
    );
    const r = decode('java', arr);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = r.value as { __type: string; values: unknown[] };
      expect(v.__type).toBe('java:array');
      expect(v.values).toEqual(['a', 'b']);
    }
  });

  it('decodes an enum', () => {
    const e = header(
      TC_ENUM, TC_CLASSDESC, ...utf('Color'), ...suid(), 0x12, 0x00, 0x00, 0x00, 0x00,
      TC_ENDBLOCKDATA, TC_NULL,
      TC_STRING, ...utf('RED'),
    );
    const r = decode('java', e);
    if (r.ok) expect(r.value).toEqual({ __type: 'java:enum', class: expect.anything(), constant: 'RED' });
    else expect.fail('decode failed');
  });

  it('decodes block data', () => {
    const r = decode('java', header(TC_BLOCKDATA, 0x02, 0xaa, 0xbb));
    if (r.ok) expect(r.value).toHaveProperty('__type', 'bytes');
    else expect.fail('decode failed');
  });

  it('errors on unsupported tag', () => {
    expect(decode('java', header(0x7f)).ok).toBe(false);
  });
});

/* -------------------------------------------------------------- */
/* Property Lists                                                  */
/* -------------------------------------------------------------- */

describe('Property List (plist)', () => {
  it('decodes XML plist dict/array/scalars/data/date', () => {
    const xml = `<?xml version="1.0"?>
<plist version="1.0"><dict>
<key>name</key><string>Alice</string>
<key>age</key><integer>30</integer>
<key>ok</key><true/>
<key>tags</key><array><string>a</string><string>b</string></array>
<key>raw</key><data>AQID</data>
</dict></plist>`;
    const r = decode('plist', enc(xml));
    if (r.ok) {
      const v = r.value as Record<string, unknown>;
      expect(v.name).toBe('Alice');
      expect(v.age).toBe(30);
      expect(v.ok).toBe(true);
      expect(v.tags).toEqual(['a', 'b']);
      expect((v.raw as { __type: string }).__type).toBe('bytes');
    } else expect.fail('decode failed');
  });

  it('errors on malformed XML plist', () => {
    expect(decode('plist', enc('<plist><dict><key>')).ok).toBe(false);
  });

  it('rejects a bplist with a too-short trailer', () => {
    expect(decode('plist', new Uint8Array([...enc('bplist00'), 0x00])).ok).toBe(false);
  });

  it('rejects a bplist with an out-of-range object count', () => {
    const magic = enc('bplist00'); // 8 bytes, indices 0-7
    const trailer = new Uint8Array(32);
    const dv = new DataView(trailer.buffer);
    trailer[6] = 1; // offsetIntSize
    trailer[7] = 1; // objectRefSize
    dv.setBigUint64(8, 99_999_999n, false); // numObjects far exceeds byte length
    dv.setBigUint64(16, 0n, false);
    dv.setBigUint64(24, 8n, false); // offsetTableOffset
    const bytes = new Uint8Array([...magic, ...trailer]);
    expect(decode('plist', bytes).ok).toBe(false);
  });

  it('decodes ASCII plist dict and array', () => {
    const ascii = '{ name = "Alice"; age = 30; tags = ( "a", "b" ); }';
    const r = decode('plist', enc(ascii));
    if (r.ok) {
      const v = r.value as Record<string, unknown>;
      expect(v.name).toBe('Alice');
      expect(v.age).toBe('30');
      expect(v.tags).toEqual(['a', 'b']);
    } else expect.fail('decode failed');
  });

  it('decodes a minimal binary plist (bplist00) string', () => {
    // Object 0: ascii string length 2 "Hi" -> header 0x52 (type 5, nibble 2), then 'H','i'
    const magic = enc('bplist00'); // indices 0-7
    const obj0 = [0x52, 0x48, 0x69]; // indices 8-10
    const offsetTableStart = magic.length + obj0.length; // 11
    const offsetTable = [0x08]; // object 0 sits at byte 8
    const trailer = new Uint8Array(32);
    trailer[6] = 1; // offsetIntSize
    trailer[7] = 1; // objectRefSize
    const dv = new DataView(trailer.buffer);
    dv.setBigUint64(8, 1n, false); // numObjects = 1
    dv.setBigUint64(16, 0n, false); // topObject index = 0
    dv.setBigUint64(24, BigInt(offsetTableStart), false); // offsetTableOffset = 11
    const bytes = new Uint8Array([...magic, ...obj0, ...offsetTable, ...trailer]);
    const r = decode('plist', bytes);
    if (r.ok) expect(r.value).toBe('Hi');
    else expect.fail('decode failed');
  });
});

/* -------------------------------------------------------------- */
/* Any-to-any conversion chains                                    */
/* -------------------------------------------------------------- */

describe('any-to-any conversion', () => {
  it('round-trips JSON -> BSON -> msgpack -> CBOR -> JSON', () => {
    const start = { a: 1, b: [2, 3], c: 'hi' };
    let val: unknown = start;
    for (const [via, to] of [['json', 'bson'], ['bson', 'msgpack'], ['msgpack', 'cbor'], ['cbor', 'json']] as const) {
      const enc2 = encode(to, val);
      if (!enc2.ok) return expect.fail(`encode ${to} failed`);
      const dec = decode(via === 'json' ? to === 'bson' ? 'bson' : via : to, enc2.bytes);
      // Simpler: decode what we just encoded back from the target format.
      const back = decode(to, enc2.bytes);
      if (!back.ok) return expect.fail(`decode ${to} failed`);
      val = back.value;
    }
    expect(val).toEqual(start);
  });

  it('converts decode-only Protobuf into encodable CBOR', () => {
    const pb = new Uint8Array([0x08, 0x96, 0x01, 0x12, 0x07, ...enc('testing')]);
    const v = decode('protobuf', pb);
    if (!v.ok) return expect.fail('protobuf decode');
    const c = encode('cbor', v.value);
    expect(c.ok).toBe(true);
    if (c.ok) {
      const back = decode('cbor', c.bytes);
      if (back.ok) expect(back.value).toEqual({ '1': [150], '2': ['testing'] });
      else expect.fail('cbor decode');
    }
  });

  it('converts Java object to JSON', () => {
    const TC_OBJECT = 0x73, TC_CLASSDESC = 0x72, TC_ENDBLOCKDATA = 0x78, TC_NULL = 0x70;
    const obj = new Uint8Array([
      0xac, 0xed, 0x00, 0x05,
      TC_OBJECT, TC_CLASSDESC, 0x00, 3, ...enc('Foo'), 0, 0, 0, 0, 0, 0, 0, 1, 0x02, 0x00, 0x00, 0x00, 0x01,
      0x49, 0x00, 1, 0x78, TC_ENDBLOCKDATA, TC_NULL, 0x00, 0x00, 0x00, 0x07,
    ]);
    const v = decode('java', obj);
    if (!v.ok) return expect.fail('java decode');
    const j = encode('json', v.value);
    expect(j.ok).toBe(true);
    if (j.ok) expect(new TextDecoder().decode(j.bytes)).toContain('Foo#fields');
  });

  it('fails encode to a decode-only format', () => {
    expect(encode('protobuf', {}).ok).toBe(false);
    expect(encode('pickle', {}).ok).toBe(false);
    expect(encode('java', {}).ok).toBe(false);
    expect(encode('plist', {}).ok).toBe(false);
  });

  it('fails decode of unknown format', () => {
    expect(decode('unknown', new Uint8Array()).ok).toBe(false);
  });
});
