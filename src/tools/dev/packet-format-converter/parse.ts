export interface Field {
  key: string;
  value: string;
}

export interface Layer {
  name: string;
  offset: number;
  length: number;
  summary: string;
  fields: Field[];
}

export interface ParsedPacket {
  bytes: Uint8Array;
  layers: Layer[];
  warnings: string[];
}

export type InputFormat = 'auto' | 'tcpdump' | 'hex' | 'scapy-string' | 'scapy-code' | 'raw-bytes';
export type OutputFormat = 'scapy-code' | 'scapy-string' | 'hex' | 'raw-bytes' | 'tcpdump';

// ─── Tcpdump input parsing ───────────────────────────────────────────────────

function hexRegion(line: string): string {
  let s = line.trim();
  s = s.replace(/^0x[0-9a-fA-F]+\s*:?\s*/i, '');
  s = s.replace(/^[0-9a-fA-F]{1,8}:\s+/, '');
  const cut = s.search(/\s{2,}\S/);
  if (cut !== -1) s = s.slice(0, cut);
  return s.trim();
}

function isHexByteLine(line: string): boolean {
  const region = hexRegion(line);
  if (!region) return false;
  if (!/\s/.test(region)) {
    return (
      /^[0-9a-fA-F]+$/.test(region) &&
      region.length >= 2 &&
      region.length % 2 === 0
    );
  }
  const tokens = region.split(/\s+/);
  if (!tokens.every((t) => /^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0))
    return false;
  return tokens.reduce((n, t) => n + t.length, 0) >= 2;
}

function extractHexFromLine(line: string): string {
  return hexRegion(line).replace(/[^0-9a-fA-F]/g, '');
}

export function splitPackets(input: string): string[][] {
  const lines = input.split(/\r?\n/);
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const raw of lines) {
    if (isHexByteLine(raw)) {
      current.push(raw);
    } else {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  const padded = cleaned.length % 2 ? '0' + cleaned : cleaned;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function parseTcpdump(input: string): ParsedPacket[] {
  const blocks = splitPackets(input);
  const out: ParsedPacket[] = [];
  for (const block of blocks) {
    const hex = block.map(extractHexFromLine).join('');
    if (!hex) continue;
    const bytes = hexToBytes(hex);
    if (bytes.length === 0) continue;
    const layers = parseLayers(bytes);
    out.push({ bytes, layers, warnings: [] });
  }
  return out;
}

// ─── Hex input parsing ───────────────────────────────────────────────────────

export function parseHexInput(input: string): ParsedPacket[] {
  const cleaned = input.replace(/[^0-9a-fA-F]/g, '');
  if (!cleaned || cleaned.length < 2) return [];
  const bytes = hexToBytes(cleaned);
  if (bytes.length === 0) return [];
  const layers = parseLayers(bytes);
  return [{ bytes, layers, warnings: [] }];
}

// ─── Raw bytes input parsing ─────────────────────────────────────────────────

function decodePythonBytesLiteral(lit: string): Uint8Array | null {
  const m = lit.match(/^b(['"])([\s\S]*)\1$/);
  if (!m) return null;
  const inner = m[2];
  const out: number[] = [];
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      const next = inner[i + 1];
      if (next === 'x' && i + 3 < inner.length) {
        const hex = inner.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out.push(parseInt(hex, 16));
          i += 4;
          continue;
        }
      } else if (next === 'n') { out.push(0x0a); i += 2; continue; }
      else if (next === 'r') { out.push(0x0d); i += 2; continue; }
      else if (next === 't') { out.push(0x09); i += 2; continue; }
      else if (next === '\\') { out.push(0x5c); i += 2; continue; }
      else if (next === "'") { out.push(0x27); i += 2; continue; }
      else if (next === '"') { out.push(0x22); i += 2; continue; }
      else if (next === '0') { out.push(0x00); i += 2; continue; }
    }
    out.push(inner.charCodeAt(i));
    i++;
  }
  return new Uint8Array(out);
}

export function parseRawBytesInput(input: string): ParsedPacket[] {
  const results: ParsedPacket[] = [];
  const re = /b(['"])(?:[^'\\]|\\.)*\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const bytes = decodePythonBytesLiteral(m[0]);
    if (bytes && bytes.length > 0) {
      const layers = parseLayers(bytes);
      results.push({ bytes, layers, warnings: [] });
    }
  }
  return results;
}

// ─── Layer encoders (for Scapy string/code input) ───────────────────────────

function parseMacStr(s: string): number[] {
  return s.split(':').map((p) => parseInt(p, 16));
}

function parseIp4Str(s: string): number[] {
  return s.split('.').map(Number);
}

function parseIp6Str(s: string): number[] {
  const parts = s.split(':');
  const out: number[] = new Array(16).fill(0);
  let idx = 0;
  for (let i = 0; i < parts.length && idx < 16; i++) {
    if (parts[i] === '') {
      const remaining = parts.length - i - 1;
      idx = 16 - remaining * 2;
      continue;
    }
    const v = parseInt(parts[i], 16);
    out[idx++] = (v >> 8) & 0xff;
    out[idx++] = v & 0xff;
  }
  return out;
}

function parseNum(s: string): number {
  if (!s || s === '') return 0;
  s = s.trim();
  if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s, 16);
  return parseInt(s, 10);
}

function parseBinaryOrDecimal(s: string): number {
  if (!s || s === '') return 0;
  s = s.trim();
  if (/^[01]+$/.test(s) && s.length > 1) return parseInt(s, 2);
  return parseNum(s);
}

function parseTcpFlags(s: string): number {
  let flags = 0;
  for (const ch of s) {
    switch (ch) {
      case 'F': flags |= 0x01; break;
      case 'S': flags |= 0x02; break;
      case 'R': flags |= 0x04; break;
      case 'P': flags |= 0x08; break;
      case 'A': flags |= 0x10; break;
      case 'U': flags |= 0x20; break;
      case 'E': flags |= 0x40; break;
      case 'C': flags |= 0x80; break;
    }
  }
  return flags;
}

const PROTO_NAME_TO_NUM: Record<string, number> = {
  'tcp': 6, 'udp': 17, 'icmp': 1, 'icmpv6': 58, 'gre': 47,
  'igmp': 2, 'ospf': 89, 'sctp': 132,
};

const ETHERTYPE_NAME_TO_NUM: Record<string, number> = {
  'ipv4': 0x0800, 'ip': 0x0800, 'ipv6': 0x86dd, 'arp': 0x0806,
  'vlan': 0x8100, 'mpls': 0x8847,
};

function resolveProto(s: string): number {
  const lower = s.toLowerCase();
  if (PROTO_NAME_TO_NUM[lower] !== undefined) return PROTO_NAME_TO_NUM[lower];
  return parseNum(s);
}

function resolveEtherType(s: string): number {
  const lower = s.toLowerCase();
  if (ETHERTYPE_NAME_TO_NUM[lower] !== undefined) return ETHERTYPE_NAME_TO_NUM[lower];
  return parseNum(s);
}

function u16be(v: number): [number, number] {
  return [(v >> 8) & 0xff, v & 0xff];
}

function u32be(v: number): [number, number, number, number] {
  return [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function encodeEthernet(f: Record<string, string>): Uint8Array {
  const dst = parseMacStr(f.dst || '00:00:00:00:00:00');
  const src = parseMacStr(f.src || '00:00:00:00:00:00');
  const type = resolveEtherType(f.type || '0x0000');
  return new Uint8Array([...dst, ...src, ...u16be(type)]);
}

function encodeIPv4(f: Record<string, string>): Uint8Array {
  const version = parseNum(f.version || '4');
  const ihl = parseNum(f.ihl || '5');
  const tos = parseNum(f.tos || '0');
  const len = parseNum(f.len || '20');
  const id = parseNum(f.id || '0');
  const flagsVal = parseBinaryOrDecimal(f.flags || '0');
  const frag = parseNum(f.frag || '0');
  const ttl = parseNum(f.ttl || '64');
  const proto = resolveProto(f.proto || '0');
  const src = parseIp4Str(f.src || '0.0.0.0');
  const dst = parseIp4Str(f.dst || '0.0.0.0');
  const flagsFrag = ((flagsVal & 0x7) << 13) | (frag & 0x1fff);
  const header = new Uint8Array(20);
  header[0] = ((version & 0xf) << 4) | (ihl & 0xf);
  header[1] = tos & 0xff;
  const [lenHi, lenLo] = u16be(len);
  header[2] = lenHi; header[3] = lenLo;
  const [idHi, idLo] = u16be(id);
  header[4] = idHi; header[5] = idLo;
  const [ffHi, ffLo] = u16be(flagsFrag);
  header[6] = ffHi; header[7] = ffLo;
  header[8] = ttl & 0xff;
  header[9] = proto & 0xff;
  header[10] = 0; header[11] = 0;
  header.set(src, 12);
  header.set(dst, 16);
  return header;
}

function encodeIPv6(f: Record<string, string>): Uint8Array {
  const tc = parseNum(f.tc || '0');
  const fl = parseNum(f.fl || f.flow || '0');
  const plen = parseNum(f.plen || '0');
  const nh = resolveProto(f.nh || '0');
  const hlim = parseNum(f.hlim || '64');
  const src = parseIp6Str(f.src || '::');
  const dst = parseIp6Str(f.dst || '::');
  const header = new Uint8Array(40);
  header[0] = 0x60 | ((tc >> 4) & 0x0f);
  header[1] = ((tc & 0x0f) << 4) | ((fl >> 16) & 0x0f);
  header[2] = (fl >> 8) & 0xff;
  header[3] = fl & 0xff;
  const [pHi, pLo] = u16be(plen);
  header[4] = pHi; header[5] = pLo;
  header[6] = nh & 0xff;
  header[7] = hlim & 0xff;
  header.set(src, 8);
  header.set(dst, 24);
  return header;
}

function encodeTCP(f: Record<string, string>): Uint8Array {
  const sport = parseNum(f.sport || '0');
  const dport = parseNum(f.dport || '0');
  const seq = parseNum(f.seq || '0');
  const ack = parseNum(f.ack || '0');
  const dataofs = parseNum(f.dataofs || '5');
  const flagsStr = f.flags || '.';
  const flags = flagsStr === '.' ? 0 : parseTcpFlags(flagsStr);
  const window = parseNum(f.window || '0');
  const urgptr = parseNum(f.urgptr || '0');
  const header = new Uint8Array(20);
  const [sHi, sLo] = u16be(sport);
  header[0] = sHi; header[1] = sLo;
  const [dHi, dLo] = u16be(dport);
  header[2] = dHi; header[3] = dLo;
  header.set(u32be(seq), 4);
  header.set(u32be(ack), 8);
  header[12] = ((dataofs & 0xf) << 4);
  header[13] = flags & 0xff;
  const [wHi, wLo] = u16be(window);
  header[14] = wHi; header[15] = wLo;
  header[16] = 0; header[17] = 0;
  const [uHi, uLo] = u16be(urgptr);
  header[18] = uHi; header[19] = uLo;
  return header;
}

function encodeUDP(f: Record<string, string>): Uint8Array {
  const sport = parseNum(f.sport || '0');
  const dport = parseNum(f.dport || '0');
  const len = parseNum(f.len || '8');
  const chksum = parseNum(f.chksum || '0');
  const header = new Uint8Array(8);
  header.set(u16be(sport), 0);
  header.set(u16be(dport), 2);
  header.set(u16be(len), 4);
  header.set(u16be(chksum), 6);
  return header;
}

function encodeICMP(f: Record<string, string>): Uint8Array {
  const type = parseNum(f.type || '0');
  const code = parseNum(f.code || '0');
  const chksum = parseNum(f.chksum || '0');
  const header = new Uint8Array(8);
  header[0] = type & 0xff;
  header[1] = code & 0xff;
  header.set(u16be(chksum), 2);
  return header;
}

function encodeARP(f: Record<string, string>): Uint8Array {
  const hwtype = parseNum(f.hwtype || '1');
  const ptype = parseNum(f.ptype || '0x0800');
  const hwlen = parseNum(f.hwlen || '6');
  const plen = parseNum(f.plen || '4');
  const op = parseNum(f.op || '1');
  const hwsrc = parseMacStr(f.hwsrc || '00:00:00:00:00:00');
  const psrc = parseIp4Str(f.psrc || '0.0.0.0');
  const hwdst = parseMacStr(f.hwdst || '00:00:00:00:00:00');
  const pdst = parseIp4Str(f.pdst || '0.0.0.0');
  const header = new Uint8Array(28);
  header.set(u16be(hwtype), 0);
  header.set(u16be(ptype), 2);
  header[4] = hwlen; header[5] = plen;
  header.set(u16be(op), 6);
  header.set(hwsrc, 8);
  header.set(psrc, 14);
  header.set(hwdst, 18);
  header.set(pdst, 24);
  return header;
}

function encodeVXLAN(f: Record<string, string>): Uint8Array {
  const flags = parseNum(f.flags || '0x08');
  const vni = parseNum(f.vni || '0');
  const header = new Uint8Array(8);
  header[0] = flags & 0xff;
  header[4] = (vni >> 16) & 0xff;
  header[5] = (vni >> 8) & 0xff;
  header[6] = vni & 0xff;
  return header;
}

function encodeMPLS(f: Record<string, string>): Uint8Array {
  const labels: { label: number; tc: number; s: number; ttl: number }[] = [];
  let i = 1;
  while (f[`label${i}`] !== undefined || (i === 1 && f.label !== undefined)) {
    const suffix = i === 1 && f.label !== undefined ? '' : String(i);
    labels.push({
      label: parseNum(f[`label${suffix}`] || '0'),
      tc: parseNum(f[`tc${suffix}`] || '0'),
      s: parseNum(f[`s${suffix}`] || '0'),
      ttl: parseNum(f[`ttl${suffix}`] || '0'),
    });
    i++;
  }
  if (labels.length === 0) labels.push({ label: 0, tc: 0, s: 1, ttl: 64 });
  const out = new Uint8Array(labels.length * 4);
  labels.forEach((l, idx) => {
    const v = ((l.label & 0xfffff) << 12) | ((l.tc & 0x7) << 9) | ((l.s & 0x1) << 8) | (l.ttl & 0xff);
    out.set(u32be(v), idx * 4);
  });
  return out;
}

function encodeGRE(f: Record<string, string>): Uint8Array {
  const flagsVer = parseNum(f.flags || '0');
  const proto = parseNum(f.proto || '0x0800');
  const parts: number[] = [...u16be(flagsVer), ...u16be(proto)];
  if (f.cksum !== undefined) {
    parts.push(...u16be(parseNum(f.cksum)));
    parts.push(...u16be(parseNum(f.reserved1 || '0')));
  }
  if (f.key !== undefined) {
    parts.push(...u32be(parseNum(f.key)));
  }
  if (f.seq !== undefined) {
    parts.push(...u32be(parseNum(f.seq)));
  }
  return new Uint8Array(parts);
}

function encodeLayer(name: string, f: Record<string, string>): Uint8Array | null {
  switch (name) {
    case 'Ether': case 'Ethernet': return encodeEthernet(f);
    case 'IP': case 'IPv4': return encodeIPv4(f);
    case 'IPv6': return encodeIPv6(f);
    case 'TCP': return encodeTCP(f);
    case 'UDP': return encodeUDP(f);
    case 'ICMP': return encodeICMP(f);
    case 'ARP': return encodeARP(f);
    case 'VXLAN': return encodeVXLAN(f);
    case 'MPLS': return encodeMPLS(f);
    case 'GRE': return encodeGRE(f);
    case 'Raw': return null;
    default: return null;
  }
}

// ─── Scapy string input parser ──────────────────────────────────────────────

interface ScapyLayerParsed {
  name: string;
  fields: Record<string, string>;
  rawLoad?: Uint8Array;
}

function parseFieldValue(text: string): { value: string; consumed: number } {
  let i = 0;
  if (i < text.length && (text[i] === "'" || text[i] === '"')) {
    const quote = text[i];
    i++;
    let val = '';
    while (i < text.length && text[i] !== quote) {
      if (text[i] === '\\' && i + 1 < text.length) {
        val += text[i] + text[i + 1];
        i += 2;
      } else {
        val += text[i];
        i++;
      }
    }
    if (i < text.length) i++;
    return { value: val, consumed: i };
  }
  if (text.startsWith("b'") || text.startsWith('b"')) {
    const quote = text[1];
    let i = 2;
    let val = "b" + quote;
    while (i < text.length && text[i] !== quote) {
      if (text[i] === '\\' && i + 1 < text.length) {
        val += text[i] + text[i + 1];
        i += 2;
      } else {
        val += text[i];
        i++;
      }
    }
    if (i < text.length) { val += text[i]; i++; }
    return { value: val, consumed: i };
  }
  let end = 0;
  while (end < text.length && text[end] !== ' ' && text[end] !== '|' && text[end] !== '>' && text[end] !== ',') {
    end++;
  }
  return { value: text.slice(0, end), consumed: end };
}

function parseFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < text.length) {
    while (i < text.length && text[i] === ' ') i++;
    if (i >= text.length || text[i] === '|' || text[i] === '>') break;
    let keyEnd = i;
    while (keyEnd < text.length && text[keyEnd] !== '=' && text[keyEnd] !== ' ' && text[keyEnd] !== '|' && text[keyEnd] !== '>') {
      keyEnd++;
    }
    if (keyEnd >= text.length || text[keyEnd] !== '=') {
      i = keyEnd;
      continue;
    }
    const key = text.slice(i, keyEnd);
    i = keyEnd + 1;
    if (i >= text.length || text[i] === '|' || text[i] === '>') {
      fields[key] = '';
      continue;
    }
    const remaining = text.slice(i);
    const { value, consumed } = parseFieldValue(remaining);
    fields[key] = value;
    i += consumed;
  }
  return fields;
}

function extractScapyLayers(input: string): ScapyLayerParsed[] {
  const layers: ScapyLayerParsed[] = [];
  let cleaned = input.trim();
  if (cleaned.startsWith('<')) cleaned = cleaned.slice(1);
  cleaned = cleaned.replace(/>+$/, '');
  const parts = cleaned.split(/\|</);
  for (const part of parts) {
    const trimmed = part.replace(/\|$/, '').trim();
    if (!trimmed) continue;
    const nameMatch = trimmed.match(/^(\w+)\s+(.*)$/s);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const fieldText = nameMatch[2].trim();
    const fields = parseFields(fieldText);
    const layer: ScapyLayerParsed = { name, fields };
    if (name === 'Raw' && fields.load) {
      const bytes = decodePythonBytesLiteral(fields.load);
      if (bytes) layer.rawLoad = bytes;
    }
    layers.push(layer);
  }
  return layers;
}

export function parseScapyString(input: string): ParsedPacket[] {
  const packets: ParsedPacket[] = [];
  const packetTexts = input.split(/\n\s*\n/);
  for (const text of packetTexts) {
    const trimmed = text.trim();
    if (!trimmed || !trimmed.includes('<')) continue;
    const layers = extractScapyLayers(trimmed);
    if (layers.length === 0) continue;
    const byteParts: Uint8Array[] = [];
    for (const layer of layers) {
      if (layer.name === 'Raw' && layer.rawLoad) {
        byteParts.push(layer.rawLoad);
      } else {
        const encoded = encodeLayer(layer.name, layer.fields);
        if (encoded) byteParts.push(encoded);
      }
    }
    if (byteParts.length === 0) continue;
    const totalLen = byteParts.reduce((s, b) => s + b.length, 0);
    const bytes = new Uint8Array(totalLen);
    let off = 0;
    for (const part of byteParts) {
      bytes.set(part, off);
      off += part.length;
    }
    const parsedLayers = parseLayers(bytes);
    packets.push({ bytes, layers: parsedLayers, warnings: [] });
  }
  return packets;
}

// ─── Scapy code input parser ────────────────────────────────────────────────

function parseScapyCodeArgs(args: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let depth = 0;
  let current = '';
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parseOneArg(current.trim(), fields);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parseOneArg(current.trim(), fields);
  return fields;
}

function parseOneArg(arg: string, fields: Record<string, string>): void {
  const eqIdx = arg.indexOf('=');
  if (eqIdx === -1) return;
  const key = arg.slice(0, eqIdx).trim();
  let value = arg.slice(eqIdx + 1).trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  fields[key] = value;
}

function extractScapyCodeLayers(input: string): ScapyLayerParsed[] {
  const layers: ScapyLayerParsed[] = [];
  const lines = input.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('from ') || trimmed.startsWith('import ') || trimmed.startsWith('#') || trimmed.startsWith('print') || trimmed.startsWith('packets')) continue;
    let expr = trimmed;
    const assignMatch = expr.match(/^\w+\s*=\s*(.+)$/);
    if (assignMatch) expr = assignMatch[1];
    const parts = splitBySlash(expr);
    for (const part of parts) {
      const layerMatch = part.trim().match(/^(\w+)\((.*)?\)$/s);
      if (!layerMatch) continue;
      const name = layerMatch[1];
      const args = layerMatch[2] || '';
      const fields = parseScapyCodeArgs(args);
      const layer: ScapyLayerParsed = { name, fields };
      if (name === 'Raw' && fields.load) {
        const bytes = decodePythonBytesLiteral(fields.load);
        if (bytes) layer.rawLoad = bytes;
      }
      layers.push(layer);
    }
  }
  return layers;
}

function splitBySlash(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let inStr: string | null = null;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inStr) {
      current += ch;
      if (ch === '\\' && i + 1 < expr.length) {
        current += expr[++i];
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inStr = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === '/' && depth === 0 && expr[i + 1] !== '/' && expr[i - 1] !== '/') {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function parseScapyCode(input: string): ParsedPacket[] {
  const allLayers = extractScapyCodeLayers(input);
  if (allLayers.length === 0) return [];
  const packetGroups: ScapyLayerParsed[][] = [];
  let current: ScapyLayerParsed[] = [];
  const lines = input.split(/\r?\n/);
  let layerIdx = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('from ') || trimmed.startsWith('import ') || trimmed.startsWith('#') || trimmed.startsWith('print') || trimmed.startsWith('packets') || !trimmed) {
      if (current.length > 0) {
        packetGroups.push(current);
        current = [];
      }
      continue;
    }
    const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (assignMatch) {
      if (current.length > 0) {
        packetGroups.push(current);
        current = [];
      }
    }
    const parts = splitBySlash(assignMatch ? assignMatch[2] : trimmed);
    for (const part of parts) {
      const layerMatch = part.trim().match(/^(\w+)\((.*)?\)$/s);
      if (!layerMatch) continue;
      if (layerIdx < allLayers.length) {
        current.push(allLayers[layerIdx++]);
      }
    }
  }
  if (current.length > 0) packetGroups.push(current);
  if (packetGroups.length === 0 && allLayers.length > 0) {
    packetGroups.push(allLayers);
  }
  const packets: ParsedPacket[] = [];
  for (const group of packetGroups) {
    const byteParts: Uint8Array[] = [];
    for (const layer of group) {
      if (layer.name === 'Raw' && layer.rawLoad) {
        byteParts.push(layer.rawLoad);
      } else {
        const encoded = encodeLayer(layer.name, layer.fields);
        if (encoded) byteParts.push(encoded);
      }
    }
    if (byteParts.length === 0) continue;
    const totalLen = byteParts.reduce((s, b) => s + b.length, 0);
    const bytes = new Uint8Array(totalLen);
    let off = 0;
    for (const part of byteParts) {
      bytes.set(part, off);
      off += part.length;
    }
    const parsedLayers = parseLayers(bytes);
    packets.push({ bytes, layers: parsedLayers, warnings: [] });
  }
  return packets;
}

// ─── Auto-detect input format ───────────────────────────────────────────────

export function detectFormat(input: string): Exclude<InputFormat, 'auto'> {
  const trimmed = input.trim();
  if (!trimmed) return 'hex';
  if (/<(?:Ether|IP|IPv6|TCP|UDP|ICMP|ARP|VXLAN|MPLS|GRE|Raw)\s/.test(trimmed)) {
    return 'scapy-string';
  }
  if (/(?:Ether|IP|IPv6|TCP|UDP|ICMP|ARP|VXLAN|MPLS|GRE|Raw)\s*\(/.test(trimmed) && trimmed.includes('/')) {
    return 'scapy-code';
  }
  if (/b['"]/.test(trimmed) && /\\x[0-9a-fA-F]{2}/.test(trimmed)) {
    return 'raw-bytes';
  }
  const lines = trimmed.split(/\r?\n/);
  const hasOffset = lines.some((l) => /^\s*0x[0-9a-fA-F]+:/.test(l));
  if (hasOffset) return 'tcpdump';
  const hexLines = lines.filter((l) => isHexByteLine(l));
  if (hexLines.length > 0) {
    const nonHexLines = lines.filter((l) => l.trim() && !isHexByteLine(l));
    const hasSummaryLines = nonHexLines.some((l) => /\bIP\b|\bARP\b|\btcp\b|\budp\b/i.test(l));
    if (hasSummaryLines) return 'tcpdump';
    return 'hex';
  }
  if (/^[0-9a-fA-F\s]+$/.test(trimmed.replace(/\n/g, ''))) return 'hex';
  return 'tcpdump';
}

// ─── Layer parsing (bytes → layers) ─────────────────────────────────────────

function mac(bytes: Uint8Array, off: number): string {
  return Array.from(bytes.slice(off, off + 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

function ipStr(bytes: Uint8Array, off: number): string {
  return Array.from(bytes.slice(off, off + 4)).join('.');
}

function ip6Str(bytes: Uint8Array, off: number): string {
  const groups: string[] = [];
  for (let i = 0; i < 8; i++) {
    groups.push(
      ((bytes[off + i * 2] << 8) | bytes[off + i * 2 + 1]).toString(16),
    );
  }
  return groups.join(':');
}

const TCP_FLAGS: [number, string][] = [
  [0x80, 'C'], [0x40, 'E'], [0x20, 'U'], [0x10, 'A'],
  [0x08, 'P'], [0x04, 'R'], [0x02, 'S'], [0x01, 'F'],
];

function tcpFlagsStr(flags: number): string {
  let s = '';
  for (const [bit, ch] of TCP_FLAGS) if (flags & bit) s += ch;
  return s || '.';
}

function u16(bytes: Uint8Array, off: number): number {
  return (bytes[off] << 8) | bytes[off + 1];
}
function u32(bytes: Uint8Array, off: number): number {
  return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
}

export function parseLayers(bytes: Uint8Array): Layer[] {
  const layers: Layer[] = [];
  const warnings: string[] = [];
  if (bytes.length === 0) return layers;

  let off = 0;
  const firstNibble = bytes[0] >> 4;

  if (firstNibble === 4 || firstNibble === 6) {
    parseIp(bytes, 0, layers, warnings);
    return layers;
  }

  if (bytes.length < 14) {
    warnings.push('Frame too short for an Ethernet header.');
    layers.push({ name: 'Raw', offset: 0, length: bytes.length, summary: `${bytes.length} byte(s)`, fields: [] });
    return layers;
  }

  let ethType = u16(bytes, 12);
  layers.push({
    name: 'Ethernet', offset: 0, length: 14,
    summary: `${mac(bytes, 6)} → ${mac(bytes, 0)}`,
    fields: [
      { key: 'dst', value: mac(bytes, 0) },
      { key: 'src', value: mac(bytes, 6) },
      { key: 'type', value: '0x' + ethType.toString(16).padStart(4, '0') },
    ],
  });
  off = 14;

  if (ethType === 0x0806) { parseArp(bytes, off, layers, warnings); return layers; }
  if (ethType === 0x0800) { parseIp(bytes, off, layers, warnings); return layers; }
  if (ethType === 0x86dd) { parseIpv6(bytes, off, layers, warnings); return layers; }
  if (ethType === 0x8100 || ethType === 0x88a8) {
    let vlanTagIndex = 0;
    while (ethType === 0x8100 || ethType === 0x88a8) {
      if (bytes.length < off + 4) return layers;
      const tci = u16(bytes, off);
      ethType = u16(bytes, off + 2);
      layers[layers.length - 1].fields.push({ key: vlanTagIndex === 0 ? 'vlan' : `vlan${vlanTagIndex + 1}`, value: '0x' + (tci & 0xfff).toString(16) });
      vlanTagIndex++;
      off += 4;
    }
    if (ethType === 0x0800) parseIp(bytes, off, layers, warnings);
    else if (ethType === 0x86dd) parseIpv6(bytes, off, layers, warnings);
    else if (ethType === 0x8847 || ethType === 0x8848) parseMpls(bytes, off, layers, warnings);
    return layers;
  }
  if (ethType === 0x8847 || ethType === 0x8848) {
    parseMpls(bytes, off, layers, warnings);
    return layers;
  }

  layers.push({ name: 'Raw', offset: off, length: bytes.length - off, summary: `${bytes.length - off} byte(s)`, fields: [] });
  return layers;
}

function parseIp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 20) { warnings.push('IPv4 header truncated.'); return; }
  const ihl = (bytes[off] & 0x0f) * 4;
  if (ihl < 20) {
    warnings.push('IPv4 IHL too short.');
    layers.push({ name: 'Raw', offset: off, length: bytes.length - off, summary: `${bytes.length - off} byte(s)`, fields: [] });
    return;
  }
  const proto = bytes[off + 9];
  const flagsFrag = u16(bytes, off + 6);
  const flags = (flagsFrag >> 13) & 0x7;
  layers.push({
    name: 'IPv4', offset: off, length: ihl,
    summary: `${ipStr(bytes, off + 12)} → ${ipStr(bytes, off + 16)}`,
    fields: [
      { key: 'version', value: '4' }, { key: 'ihl', value: String(ihl / 4) },
      { key: 'tos', value: '0x' + bytes[off + 1].toString(16).padStart(2, '0') },
      { key: 'len', value: String(u16(bytes, off + 2)) },
      { key: 'id', value: '0x' + u16(bytes, off + 4).toString(16).padStart(4, '0') },
      { key: 'flags', value: flags.toString(2).padStart(3, '0') },
      { key: 'frag', value: String(flagsFrag & 0x1fff) },
      { key: 'ttl', value: String(bytes[off + 8]) },
      { key: 'proto', value: String(proto) },
      { key: 'src', value: ipStr(bytes, off + 12) },
      { key: 'dst', value: ipStr(bytes, off + 16) },
    ],
  });
  parseL4(bytes, off + ihl, proto, layers, warnings);
}

function parseIpv6(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 40) { warnings.push('IPv6 header truncated.'); return; }
  const plen = u16(bytes, off + 4);
  const nh = bytes[off + 6];
  layers.push({
    name: 'IPv6', offset: off, length: 40,
    summary: `${ip6Str(bytes, off + 8)} → ${ip6Str(bytes, off + 24)}`,
    fields: [
      { key: 'version', value: '6' },
      { key: 'tc', value: '0x' + (((bytes[off] & 0x0f) << 4) | (bytes[off + 1] >> 4)).toString(16) },
      { key: 'flow', value: '0x' + (((bytes[off + 1] & 0x0f) << 16) | (bytes[off + 2] << 8) | bytes[off + 3]).toString(16) },
      { key: 'plen', value: String(plen) },
      { key: 'nh', value: String(nh) },
      { key: 'hlim', value: String(bytes[off + 7]) },
      { key: 'src', value: ip6Str(bytes, off + 8) },
      { key: 'dst', value: ip6Str(bytes, off + 24) },
    ],
  });
  parseL4(bytes, off + 40, nh, layers, warnings);
}

function parseL4(bytes: Uint8Array, off: number, proto: number, layers: Layer[], warnings: string[]): void {
  if (proto === 6) parseTcp(bytes, off, layers, warnings);
  else if (proto === 17) parseUdp(bytes, off, layers, warnings);
  else if (proto === 1 || proto === 58) parseIcmp(bytes, off, layers, warnings);
  else if (proto === 47) parseGre(bytes, off, layers, warnings);
  else if (bytes.length > off) {
    layers.push({ name: 'Raw', offset: off, length: bytes.length - off, summary: `${bytes.length - off} byte(s)`, fields: [] });
  }
}

const GRE_INNER: Record<number, number> = { 0x0800: 4, 0x86dd: 6, 0x8847: 47, 0x8848: 47 };

function parseGre(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 4) { warnings.push('GRE header truncated.'); return; }
  const flagsVer = u16(bytes, off);
  const chksumPresent = (flagsVer & 0x8000) !== 0;
  const keyPresent = (flagsVer & 0x2000) !== 0;
  const seqPresent = (flagsVer & 0x1000) !== 0;
  const proto = u16(bytes, off + 2);
  let hdrLen = 4;
  const fields: Field[] = [
    { key: 'flags', value: '0x' + flagsVer.toString(16).padStart(4, '0') },
    { key: 'proto', value: '0x' + proto.toString(16).padStart(4, '0') },
  ];
  if (chksumPresent) { fields.push({ key: 'cksum', value: '0x' + u16(bytes, off + hdrLen).toString(16).padStart(4, '0') }); hdrLen += 4; }
  if (keyPresent) { fields.push({ key: 'key', value: '0x' + u32(bytes, off + hdrLen).toString(16).padStart(8, '0') }); hdrLen += 4; }
  if (seqPresent) { fields.push({ key: 'seq', value: String(u32(bytes, off + hdrLen)) }); hdrLen += 4; }
  layers.push({ name: 'GRE', offset: off, length: hdrLen, summary: `proto 0x${proto.toString(16).padStart(4, '0')}`, fields });
  const payloadOff = off + hdrLen;
  if (bytes.length <= payloadOff) return;
  const inner = GRE_INNER[proto];
  if (inner === 4) parseIp(bytes, payloadOff, layers, warnings);
  else if (inner === 6) parseIpv6(bytes, payloadOff, layers, warnings);
  else if (inner === 47) parseMpls(bytes, payloadOff, layers, warnings);
  else {
    layers.push({ name: 'Raw', offset: payloadOff, length: bytes.length - payloadOff, summary: `${bytes.length - payloadOff} byte(s)`, fields: [] });
  }
}

function parseMpls(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  const labels: { label: number; tc: number; s: number; ttl: number }[] = [];
  let cur = off;
  while (bytes.length >= cur + 4) {
    const v = u32(bytes, cur);
    const label = v >>> 12;
    const tc = (v >>> 9) & 0x7;
    const s = (v >>> 8) & 0x1;
    const ttl = v & 0xff;
    labels.push({ label, tc, s, ttl });
    cur += 4;
    if (s === 1) break;
  }
  if (labels.length === 0) { warnings.push('MPLS label stack truncated.'); return; }
  const fields: Field[] = [];
  const multi = labels.length > 1;
  labels.forEach((l, i) => {
    fields.push({ key: `label${multi ? i + 1 : ''}`, value: String(l.label) });
    fields.push({ key: `tc${multi ? i + 1 : ''}`, value: String(l.tc) });
    fields.push({ key: `s${multi ? i + 1 : ''}`, value: String(l.s) });
    fields.push({ key: `ttl${multi ? i + 1 : ''}`, value: String(l.ttl) });
  });
  layers.push({ name: 'MPLS', offset: off, length: cur - off, summary: labels.map((l) => String(l.label)).join(', '), fields });
  if (bytes.length > cur) {
    const nibble = bytes[cur] >> 4;
    if (nibble === 4) parseIp(bytes, cur, layers, warnings);
    else if (nibble === 6) parseIpv6(bytes, cur, layers, warnings);
    else {
      layers.push({ name: 'Raw', offset: cur, length: bytes.length - cur, summary: `${bytes.length - cur} byte(s)`, fields: [] });
    }
  }
}

function parseTcp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 20) { warnings.push('TCP header truncated.'); return; }
  const dataOff = (bytes[off + 12] >> 4) * 4;
  const flags = bytes[off + 13];
  layers.push({
    name: 'TCP', offset: off, length: Math.min(dataOff, bytes.length - off),
    summary: `${u16(bytes, off)} → ${u16(bytes, off + 2)} [${tcpFlagsStr(flags)}]`,
    fields: [
      { key: 'sport', value: String(u16(bytes, off)) },
      { key: 'dport', value: String(u16(bytes, off + 2)) },
      { key: 'seq', value: String(u32(bytes, off + 4)) },
      { key: 'ack', value: String(u32(bytes, off + 8)) },
      { key: 'dataofs', value: String(dataOff / 4) },
      { key: 'flags', value: tcpFlagsStr(flags) },
      { key: 'window', value: String(u16(bytes, off + 14)) },
      { key: 'urgptr', value: String(u16(bytes, off + 18)) },
    ],
  });
  if (bytes.length > off + dataOff) {
    layers.push({ name: 'Raw', offset: off + dataOff, length: bytes.length - off - dataOff, summary: `${bytes.length - off - dataOff} byte(s)`, fields: [] });
  }
}

function parseUdp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 8) { warnings.push('UDP header truncated.'); return; }
  const sport = u16(bytes, off);
  const dport = u16(bytes, off + 2);
  const len = u16(bytes, off + 4);
  layers.push({
    name: 'UDP', offset: off, length: 8,
    summary: `${sport} → ${dport}`,
    fields: [
      { key: 'sport', value: String(sport) },
      { key: 'dport', value: String(dport) },
      { key: 'len', value: String(len) },
      { key: 'chksum', value: '0x' + u16(bytes, off + 6).toString(16).padStart(4, '0') },
    ],
  });
  const payloadOff = off + 8;
  if (dport === 4789 || sport === 4789) {
    parseVxlan(bytes, payloadOff, layers, warnings);
  } else if (bytes.length > payloadOff) {
    layers.push({ name: 'Raw', offset: payloadOff, length: bytes.length - payloadOff, summary: `${bytes.length - payloadOff} byte(s)`, fields: [] });
  }
}

function parseVxlan(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 8) { warnings.push('VXLAN header truncated.'); return; }
  const flags = bytes[off];
  const vni = (bytes[off + 4] << 16) | (bytes[off + 5] << 8) | bytes[off + 6];
  layers.push({
    name: 'VXLAN', offset: off, length: 8,
    summary: `vni ${vni}`,
    fields: [
      { key: 'flags', value: '0x' + flags.toString(16).padStart(2, '0') },
      { key: 'vni', value: String(vni) },
    ],
  });
  parseLayers(bytes.slice(off + 8)).forEach((l) => {
    layers.push({ ...l, offset: l.offset + off + 8 });
  });
}

function parseIcmp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 8) { warnings.push('ICMP header truncated.'); return; }
  const type = bytes[off];
  const code = bytes[off + 1];
  layers.push({
    name: 'ICMP', offset: off, length: 8,
    summary: `type ${type} code ${code}`,
    fields: [
      { key: 'type', value: String(type) },
      { key: 'code', value: String(code) },
      { key: 'chksum', value: '0x' + u16(bytes, off + 2).toString(16).padStart(4, '0') },
    ],
  });
  if (bytes.length > off + 8) {
    layers.push({ name: 'Raw', offset: off + 8, length: bytes.length - off - 8, summary: `${bytes.length - off - 8} byte(s)`, fields: [] });
  }
}

function parseArp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 28) { warnings.push('ARP header truncated.'); return; }
  const op = u16(bytes, off + 6);
  layers.push({
    name: 'ARP', offset: off, length: 28,
    summary: op === 1 ? 'request' : op === 2 ? 'reply' : `op ${op}`,
    fields: [
      { key: 'hwtype', value: String(u16(bytes, off)) },
      { key: 'ptype', value: '0x' + u16(bytes, off + 2).toString(16).padStart(4, '0') },
      { key: 'hwlen', value: String(bytes[off + 4]) },
      { key: 'plen', value: String(bytes[off + 5]) },
      { key: 'op', value: String(op) },
      { key: 'hwsrc', value: mac(bytes, off + 8) },
      { key: 'psrc', value: ipStr(bytes, off + 14) },
      { key: 'hwdst', value: mac(bytes, off + 18) },
      { key: 'pdst', value: ipStr(bytes, off + 24) },
    ],
  });
}

// ─── Output: bytes → hex ────────────────────────────────────────────────────

export function bytesToHex(bytes: Uint8Array, separator = ''): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
    if (separator) s += separator;
  }
  return separator ? s.replace(new RegExp(separator + '$'), '') : s;
}

// ─── Output: bytes → Python bytes literal ──────────────────────────────────────

export function bytesToPythonLiteral(bytes: Uint8Array): string {
  let s = "b'";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x5c) s += '\\\\';
    else if (b === 0x27) s += "\\'";
    else if (b === 0x09) s += '\\t';
    else if (b === 0x0a) s += '\\n';
    else if (b === 0x0d) s += '\\r';
    else if (b >= 0x20 && b <= 0x7e) s += String.fromCharCode(b);
    else s += '\\x' + b.toString(16).padStart(2, '0');
  }
  s += "'";
  return s;
}

// ─── Output: Scapy Python code ──────────────────────────────────────────────

function scapyLayer(layer: Layer): string | null {
  const f = Object.fromEntries(layer.fields.map((x) => [x.key, x.value]));
  switch (layer.name) {
    case 'Ethernet':
      return `Ether(dst='${f.dst}', src='${f.src}', type=${f.type})`;
    case 'ARP':
      return `ARP(hwtype=${f.hwtype}, ptype=${f.ptype}, hwlen=${f.hwlen}, plen=${f.plen}, op=${f.op}, hwsrc='${f.hwsrc}', psrc='${f.psrc}', hwdst='${f.hwdst}', pdst='${f.pdst}')`;
    case 'IPv4':
      return `IP(version=${f.version}, ihl=${f.ihl}, tos=${f.tos}, len=${f.len}, id=${f.id}, flags=${parseInt(f.flags, 2)}, frag=${f.frag}, ttl=${f.ttl}, proto=${f.proto}, src='${f.src}', dst='${f.dst}')`;
    case 'IPv6':
      return `IPv6(tc=${f.tc}, fl=${f.flow}, plen=${f.plen}, nh=${f.nh}, hlim=${f.hlim}, src='${f.src}', dst='${f.dst}')`;
    case 'TCP':
      return `TCP(sport=${f.sport}, dport=${f.dport}, seq=${f.seq}, ack=${f.ack}, dataofs=${f.dataofs}, flags='${f.flags}', window=${f.window}, urgptr=${f.urgptr})`;
    case 'UDP':
      return `UDP(sport=${f.sport}, dport=${f.dport}, len=${f.len})`;
    case 'ICMP':
      return `ICMP(type=${f.type}, code=${f.code})`;
    case 'VXLAN':
      return `VXLAN(flags=${f.flags}, vni=${f.vni})`;
    case 'MPLS': {
      const segs: string[] = [];
      for (let i = 0; i < layer.fields.length; i += 4) {
        const label = layer.fields[i].value;
        const tc = layer.fields[i + 1].value;
        const s = layer.fields[i + 2].value;
        const ttl = layer.fields[i + 3].value;
        segs.push(`MPLS(label=${label}, tc=${tc}, s=${s}, ttl=${ttl})`);
      }
      return segs.join(' / ');
    }
    case 'GRE': {
      const parts = [`proto=${f.proto}`];
      if (f.cksum) parts.push(`chksum_present=1`);
      if (f.key) parts.push(`key=${parseInt(f.key, 16)}`);
      if (f.seq) parts.push(`seq=${f.seq}`);
      return `GRE(${parts.join(', ')})`;
    }
    case 'Raw':
      return null;
    default:
      return null;
  }
}

export function toScapy(packets: ParsedPacket[]): string {
  if (packets.length === 0) return '# No packets were parsed from the input.';
  const lines: string[] = ['from scapy.all import *', ''];
  const assigns: string[] = [];
  packets.forEach((pkt, i) => {
    const parts: string[] = [];
    for (const layer of pkt.layers) {
      if (layer.name === 'Raw') {
        const rawBytes = pkt.bytes.slice(layer.offset, layer.offset + layer.length);
        parts.push(`Raw(load=${bytesToPythonLiteral(rawBytes)})`);
        continue;
      }
      const c = scapyLayer(layer);
      if (c) parts.push(c);
    }
    if (parts.length === 0) {
      const lit = bytesToPythonLiteral(pkt.bytes);
      lines.push(`pkt${i} = Raw(load=${lit})`);
      assigns.push(`pkt${i}`);
      return;
    }
    const consumed = pkt.layers.reduce((sum, l) => sum + l.length, 0);
    if (consumed < pkt.bytes.length) {
      const tail = pkt.bytes.slice(consumed);
      parts.push(`Raw(load=${bytesToPythonLiteral(tail)})`);
    }
    lines.push(`pkt${i} = ${parts.join(' / ')}`);
    assigns.push(`pkt${i}`);
  });
  lines.push('');
  if (assigns.length === 1) {
    lines.push('print(bytes(pkt0).hex())');
  } else {
    lines.push(`packets = [${assigns.join(', ')}]`);
    lines.push('print([bytes(p).hex() for p in packets])');
  }
  return lines.join('\n');
}

// ─── Output: Scapy string (repr) ────────────────────────────────────────────

function scapyStringLayer(layer: Layer): string {
  const f = Object.fromEntries(layer.fields.map((x) => [x.key, x.value]));
  switch (layer.name) {
    case 'Ethernet':
      return `<Ether  dst=${f.dst} src=${f.src} type=${formatEtherType(f.type)}`;
    case 'ARP': {
      const opStr = f.op === '1' ? 'who-has' : f.op === '2' ? 'is-at' : `op=${f.op}`;
      return `<ARP  hwtype=${f.hwtype} ptype=${f.ptype} hwlen=${f.hwlen} plen=${f.plen} op=${opStr} hwsrc=${f.hwsrc} psrc=${f.psrc} hwdst=${f.hwdst} pdst=${f.pdst}`;
    }
    case 'IPv4':
      return `<IP  version=${f.version} ihl=${f.ihl} tos=${f.tos} len=${f.len} id=${f.id} flags=${f.flags} frag=${f.frag} ttl=${f.ttl} proto=${formatProto(f.proto)} src=${f.src} dst=${f.dst}`;
    case 'IPv6':
      return `<IPv6  version=${f.version} tc=${f.tc} fl=${f.flow} plen=${f.plen} nh=${f.nh} hlim=${f.hlim} src=${f.src} dst=${f.dst}`;
    case 'TCP':
      return `<TCP  sport=${f.sport} dport=${f.dport} seq=${f.seq} ack=${f.ack} dataofs=${f.dataofs} flags=${f.flags} window=${f.window} urgptr=${f.urgptr}`;
    case 'UDP':
      return `<UDP  sport=${f.sport} dport=${f.dport} len=${f.len} chksum=${f.chksum}`;
    case 'ICMP':
      return `<ICMP  type=${f.type} code=${f.code} chksum=${f.chksum}`;
    case 'VXLAN':
      return `<VXLAN  flags=${f.flags} vni=${f.vni}`;
    case 'MPLS': {
      const parts: string[] = [];
      for (let i = 0; i < layer.fields.length; i += 4) {
        parts.push(`label=${layer.fields[i].value} tc=${layer.fields[i + 1].value} s=${layer.fields[i + 2].value} ttl=${layer.fields[i + 3].value}`);
      }
      return `<MPLS  ${parts.join(' | ')}`;
    }
    case 'GRE': {
      const parts = [`proto=${f.proto}`];
      if (f.cksum) parts.push(`chksum=${f.cksum}`);
      if (f.key) parts.push(`key=${f.key}`);
      if (f.seq) parts.push(`seq=${f.seq}`);
      return `<GRE  ${parts.join(' ')}`;
    }
    case 'Raw':
      return `<Raw  load=${bytesToPythonLiteral(new Uint8Array(0))}`;
    default:
      return `<${layer.name}`;
  }
}

function formatEtherType(v: string): string {
  const num = parseInt(v, 16);
  switch (num) {
    case 0x0800: return 'IPv4';
    case 0x86dd: return 'IPv6';
    case 0x0806: return 'ARP';
    case 0x8100: return '802.1Q';
    case 0x8847: return 'MPLS';
    default: return v;
  }
}

function formatProto(v: string): string {
  const num = parseInt(v, 10);
  switch (num) {
    case 6: return 'tcp';
    case 17: return 'udp';
    case 1: return 'icmp';
    case 58: return 'icmpv6';
    case 47: return 'gre';
    default: return v;
  }
}

export function toScapyString(packets: ParsedPacket[]): string {
  if (packets.length === 0) return '# No packets were parsed from the input.';
  return packets.map((pkt, i) => {
    const parts: string[] = [];
    for (const layer of pkt.layers) {
      if (layer.name === 'Raw') {
        const rawBytes = pkt.bytes.slice(layer.offset, layer.offset + layer.length);
        parts.push(`<Raw  load=${bytesToPythonLiteral(rawBytes)}`);
      } else {
        parts.push(scapyStringLayer(layer));
      }
    }
    const consumed = pkt.layers.reduce((sum, l) => sum + l.length, 0);
    if (consumed < pkt.bytes.length) {
      const tail = pkt.bytes.slice(consumed);
      parts.push(`<Raw  load=${bytesToPythonLiteral(tail)}`);
    }
    const closing = '>'.repeat(parts.length);
    const result = parts.join(' |') + ' |' + closing;
    return packets.length > 1 ? `# packet ${i}\n${result}` : result;
  }).join('\n\n');
}

// ─── Output: Tcpdump hex dump ───────────────────────────────────────────────

function asciiByte(b: number): string {
  return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
}

function formatTcpdumpHexLine(bytes: Uint8Array, offset: number): string {
  const hexParts: string[] = [];
  const asciiParts: string[] = [];
  for (let i = 0; i < 16; i++) {
    if (i < bytes.length) {
      hexParts.push(bytes[i].toString(16).padStart(2, '0'));
      asciiParts.push(asciiByte(bytes[i]));
    } else {
      hexParts.push('  ');
      asciiParts.push(' ');
    }
  }
  const hexGroups: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    hexGroups.push(hexParts[i] + hexParts[i + 1]);
  }
  const offsetStr = '0x' + offset.toString(16).padStart(4, '0');
  return `\t${offsetStr}:\t${hexGroups.join(' ')}  ${asciiParts.join('')}`;
}

function packetSummary(pkt: ParsedPacket): string {
  const ipLayer = pkt.layers.find((l) => l.name === 'IPv4' || l.name === 'IPv6');
  const l4Layer = pkt.layers.find((l) => l.name === 'TCP' || l.name === 'UDP');
  if (!ipLayer || !l4Layer) return `${pkt.bytes.length} bytes`;
  const f = Object.fromEntries(ipLayer.fields.map((x) => [x.key, x.value]));
  const l4f = Object.fromEntries(l4Layer.fields.map((x) => [x.key, x.value]));
  const proto = l4Layer.name.toLowerCase();
  const src = f.src;
  const dst = f.dst;
  const sport = l4f.sport;
  const dport = l4f.dport;
  let flags = '';
  if (l4Layer.name === 'TCP') {
    flags = ` Flags [${l4f.flags}],`;
  }
  return `IP ${src}.${sport} > ${dst}.${dport}:${flags} ${proto} ${pkt.bytes.length}`;
}

export function toTcpdump(packets: ParsedPacket[]): string {
  if (packets.length === 0) return '# No packets were parsed from the input.';
  return packets.map((pkt, i) => {
    const summary = packetSummary(pkt);
    const header = packets.length > 1
      ? `# packet ${i}\n${new Date().toISOString().slice(11, 23)} ${summary}`
      : `${new Date().toISOString().slice(11, 23)} ${summary}`;
    const hexLines: string[] = [];
    for (let off = 0; off < pkt.bytes.length; off += 16) {
      const chunk = pkt.bytes.slice(off, off + 16);
      hexLines.push(formatTcpdumpHexLine(chunk, off));
    }
    return `${header}\n${hexLines.join('\n')}`;
  }).join('\n\n');
}

// ─── Output: hex per packet ─────────────────────────────────────────────────

export function toHexOutput(packets: ParsedPacket[]): string {
  if (packets.length === 0) return '# No packets were parsed from the input.';
  return packets.map((p, i) => {
    const prefix = packets.length > 1 ? `# packet ${i}\n` : '';
    return `${prefix}${bytesToHex(p.bytes)}`;
  }).join('\n\n');
}

// ─── Output: raw bytes (Python) per packet ──────────────────────────────────

export function toRawBytesOutput(packets: ParsedPacket[]): string {
  if (packets.length === 0) return '# No packets were parsed from the input.';
  return packets.map((p, i) => `pkt${i} = ${bytesToPythonLiteral(p.bytes)}`).join('\n');
}
