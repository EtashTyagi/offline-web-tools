// Pure, testable logic for the tcpdump-to-Scapy/hex/Python converter.
// No DOM, no React — imported by both the component and the unit tests.

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

/**
 * Extract the hex-byte region of a single tcpdump hex line: strip a leading
 * offset token (`0x0010:` or `0010:`) and cut off the ASCII column that
 * tcpdump prints (two-or-more spaces) to the right of the hex in `-X`/`-XX`.
 * Returns the raw left region (hex pairs, possibly space-separated), trimmed.
 */
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
  // Space-separated hex tokens; every token must be whole bytes (even length).
  const tokens = region.split(/\s+/);
  if (
    !tokens.every((t) => /^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0)
  )
    return false;
  return tokens.reduce((n, t) => n + t.length, 0) >= 2;
}

function extractHexFromLine(line: string): string {
  return hexRegion(line).replace(/[^0-9a-fA-F]/g, '');
}

/**
 * Split a tcpdump text dump into per-packet hex blocks. A "block" is a run of
 * hex-bearing lines. Non-hex lines (timestamps, `IP ...` summaries, blank lines)
 * act as separators and are otherwise ignored.
 */
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

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  const padded = cleaned.length % 2 ? '0' + cleaned : cleaned;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array, separator = ''): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
    if (separator) s += separator;
  }
  return separator ? s.replace(new RegExp(separator + '$'), '') : s;
}

/** Python `bytes` literal, printable ASCII kept as characters. */
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
  [0x80, 'C'],
  [0x40, 'E'],
  [0x20, 'U'],
  [0x10, 'A'],
  [0x08, 'P'],
  [0x04, 'R'],
  [0x02, 'S'],
  [0x01, 'F'],
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
  return (
    (bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]
  ) >>> 0;
}

/**
 * Parse a single packet's raw bytes into a chain of layers. Handles Ethernet,
  ARP, raw IPv4/IPv6, TCP, UDP, ICMP, and VXLAN (UDP/4789) with an inner
 * Ethernet frame. Returns the flat layer list plus any warnings.
 */
export function parseLayers(bytes: Uint8Array): Layer[] {
  const layers: Layer[] = [];
  const warnings: string[] = [];
  if (bytes.length === 0) return layers;

  let off = 0;
  const firstNibble = bytes[0] >> 4;

  if (firstNibble === 4 || firstNibble === 6) {
    // Raw IP (no Ethernet).
    parseIp(bytes, 0, layers, warnings);
    return layers;
  }

  if (bytes.length < 14) {
    warnings.push('Frame too short for an Ethernet header.');
    layers.push({
      name: 'Raw',
      offset: 0,
      length: bytes.length,
      summary: `${bytes.length} byte(s)`,
      fields: [],
    });
    return layers;
  }

  let ethType = u16(bytes, 12);
  layers.push({
    name: 'Ethernet',
    offset: 0,
    length: 14,
    summary: `${mac(bytes, 6)} → ${mac(bytes, 0)}`,
    fields: [
      { key: 'dst', value: mac(bytes, 0) },
      { key: 'src', value: mac(bytes, 6) },
      { key: 'type', value: '0x' + ethType.toString(16).padStart(4, '0') },
    ],
  });
  off = 14;

  if (ethType === 0x0806) {
    parseArp(bytes, off, layers, warnings);
    return layers;
  }
  if (ethType === 0x0800) {
    parseIp(bytes, off, layers, warnings);
    return layers;
  }
  if (ethType === 0x86dd) {
    parseIpv6(bytes, off, layers, warnings);
    return layers;
  }
  // 802.1Q/QinQ VLAN tags may stack; consume each 4-byte tag, then dispatch.
  if (ethType === 0x8100 || ethType === 0x88a8) {
    let vlanTagIndex = 0;
    while (ethType === 0x8100 || ethType === 0x88a8) {
      if (bytes.length < off + 4) return layers;
      const tci = u16(bytes, off);
      ethType = u16(bytes, off + 2);
      layers[layers.length - 1].fields.push({
        key: vlanTagIndex === 0 ? 'vlan' : `vlan${vlanTagIndex + 1}`,
        value: '0x' + (tci & 0xfff).toString(16),
      });
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

  layers.push({
    name: 'Raw',
    offset: off,
    length: bytes.length - off,
    summary: `${bytes.length - off} byte(s)`,
    fields: [],
  });
  return layers;
}

function parseIp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 20) {
    warnings.push('IPv4 header truncated.');
    return;
  }
  const ihl = (bytes[off] & 0x0f) * 4;
  if (ihl < 20) {
    warnings.push('IPv4 IHL too short.');
    layers.push({
      name: 'Raw',
      offset: off,
      length: bytes.length - off,
      summary: `${bytes.length - off} byte(s)`,
      fields: [],
    });
    return;
  }
  const proto = bytes[off + 9];
  const flagsFrag = u16(bytes, off + 6);
  const flags = (flagsFrag >> 13) & 0x7;
  layers.push({
    name: 'IPv4',
    offset: off,
    length: ihl,
    summary: `${ipStr(bytes, off + 12)} → ${ipStr(bytes, off + 16)}`,
    fields: [
      { key: 'version', value: '4' },
      { key: 'ihl', value: String(ihl / 4) },
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
  if (bytes.length < off + 40) {
    warnings.push('IPv6 header truncated.');
    return;
  }
  const plen = u16(bytes, off + 4);
  const nh = bytes[off + 6];
  layers.push({
    name: 'IPv6',
    offset: off,
    length: 40,
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
    layers.push({
      name: 'Raw',
      offset: off,
      length: bytes.length - off,
      summary: `${bytes.length - off} byte(s)`,
      fields: [],
    });
  }
}

/** GRE protocol numbers that map to a known inner parser. */
const GRE_INNER: Record<number, number> = {
  0x0800: 4, // IPv4
  0x86dd: 6, // IPv6
  0x8847: 47, // MPLS unicast
  0x8848: 47, // MPLS multicast
};

/**
 * Parse a GRE header (RFC 2784/2890). The base header is 4 bytes; optional
 * checksum (C), key (K) and sequence (S) fields extend it by 4 bytes each.
 * The inner protocol is dispatched by its EtherType/IP-proto nibble.
 */
function parseGre(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 4) {
    warnings.push('GRE header truncated.');
    return;
  }
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
  layers.push({
    name: 'GRE',
    offset: off,
    length: hdrLen,
    summary: `proto 0x${proto.toString(16).padStart(4, '0')}`,
    fields,
  });
  const payloadOff = off + hdrLen;
  if (bytes.length <= payloadOff) return;
  const inner = GRE_INNER[proto];
  if (inner === 4) parseIp(bytes, payloadOff, layers, warnings);
  else if (inner === 6) parseIpv6(bytes, payloadOff, layers, warnings);
  else if (inner === 47) parseMpls(bytes, payloadOff, layers, warnings);
  else {
    layers.push({
      name: 'Raw',
      offset: payloadOff,
      length: bytes.length - payloadOff,
      summary: `${bytes.length - payloadOff} byte(s)`,
      fields: [],
    });
  }
}

/**
 * Parse an MPLS label stack. Each shim header is 4 bytes (label 20b, TC 3b,
 * Bottom-of-Stack 1b, TTL 8b). Labels are consumed until S=1, then the next
 * header is detected by IP-version nibble (4→IPv4, 6→IPv6).
 */
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
  if (labels.length === 0) {
    warnings.push('MPLS label stack truncated.');
    return;
  }
  const fields: Field[] = [];
  const multi = labels.length > 1;
  labels.forEach((l, i) => {
    fields.push({ key: `label${multi ? i + 1 : ''}`, value: String(l.label) });
    fields.push({ key: `tc${multi ? i + 1 : ''}`, value: String(l.tc) });
    fields.push({ key: `s${multi ? i + 1 : ''}`, value: String(l.s) });
    fields.push({ key: `ttl${multi ? i + 1 : ''}`, value: String(l.ttl) });
  });
  layers.push({
    name: 'MPLS',
    offset: off,
    length: cur - off,
    summary: labels.map((l) => String(l.label)).join(', '),
    fields,
  });
  // After the label stack, detect the inner header by its first nibble.
  if (bytes.length > cur) {
    const nibble = bytes[cur] >> 4;
    if (nibble === 4) parseIp(bytes, cur, layers, warnings);
    else if (nibble === 6) parseIpv6(bytes, cur, layers, warnings);
    else {
      layers.push({
        name: 'Raw',
        offset: cur,
        length: bytes.length - cur,
        summary: `${bytes.length - cur} byte(s)`,
        fields: [],
      });
    }
  }
}

function parseTcp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 20) {
    warnings.push('TCP header truncated.');
    return;
  }
  const dataOff = (bytes[off + 12] >> 4) * 4;
  const flags = bytes[off + 13];
  layers.push({
    name: 'TCP',
    offset: off,
    length: Math.min(dataOff, bytes.length - off),
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
    layers.push({
      name: 'Raw',
      offset: off + dataOff,
      length: bytes.length - off - dataOff,
      summary: `${bytes.length - off - dataOff} byte(s)`,
      fields: [],
    });
  }
}

function parseUdp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 8) {
    warnings.push('UDP header truncated.');
    return;
  }
  const sport = u16(bytes, off);
  const dport = u16(bytes, off + 2);
  const len = u16(bytes, off + 4);
  layers.push({
    name: 'UDP',
    offset: off,
    length: 8,
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
    layers.push({
      name: 'Raw',
      offset: payloadOff,
      length: bytes.length - payloadOff,
      summary: `${bytes.length - payloadOff} byte(s)`,
      fields: [],
    });
  }
}

function parseVxlan(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 8) {
    warnings.push('VXLAN header truncated.');
    return;
  }
  const flags = bytes[off];
  const vni = (bytes[off + 4] << 16) | (bytes[off + 5] << 8) | bytes[off + 6];
  layers.push({
    name: 'VXLAN',
    offset: off,
    length: 8,
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
  if (bytes.length < off + 8) {
    warnings.push('ICMP header truncated.');
    return;
  }
  const type = bytes[off];
  const code = bytes[off + 1];
  layers.push({
    name: 'ICMP',
    offset: off,
    length: 8,
    summary: `type ${type} code ${code}`,
    fields: [
      { key: 'type', value: String(type) },
      { key: 'code', value: String(code) },
      { key: 'chksum', value: '0x' + u16(bytes, off + 2).toString(16).padStart(4, '0') },
    ],
  });
  if (bytes.length > off + 8) {
    layers.push({
      name: 'Raw',
      offset: off + 8,
      length: bytes.length - off - 8,
      summary: `${bytes.length - off - 8} byte(s)`,
      fields: [],
    });
  }
}

function parseArp(bytes: Uint8Array, off: number, layers: Layer[], warnings: string[]): void {
  if (bytes.length < off + 28) {
    warnings.push('ARP header truncated.');
    return;
  }
  const op = u16(bytes, off + 6);
  layers.push({
    name: 'ARP',
    offset: off,
    length: 28,
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

/** Build a Scapy constructor argument string for a single layer. */
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
      // One MPLS layer may hold a whole label stack (4 fields per label).
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

/**
 * Generate Python/Scapy source that reconstructs the given packets. The trailing
 * Raw layer (if any) is attached with `Raw(load=b'...')` so `bytes(pkt)` matches
 * the original.
 */
export function toScapy(packets: ParsedPacket[]): string {
  if (packets.length === 0) {
    return '# No packets were parsed from the input.';
  }
  const lines: string[] = [
    'from scapy.all import *',
    '',
  ];
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
    // Safety: if the parsed layers did not cover every byte, attach the
    // remaining tail as a Raw layer so `bytes(pkt)` matches the input.
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

/**
 * Convert a tcpdump text dump (plain hex, `-x`/`-xx` offset hex, or `-X` hex +
 * ASCII column, single or multiple packets) into structured packets.
 */
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
