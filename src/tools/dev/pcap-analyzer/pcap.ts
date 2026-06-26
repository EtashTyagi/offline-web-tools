// Pure, testable pcap parsing + analysis. No DOM, no React.
// Imported by the component's Web Worker and by the unit tests.

export interface PcapLayer {
  name: string;
  offset: number;
  length: number;
  summary: string;
  fields: Record<string, string>;
  color: string;
}

export interface PcapPacket {
  index: number;
  tsSec: number;
  tsFrac: number;
  tsNs: number;
  capLen: number;
  origLen: number;
  bytes?: Uint8Array; // optional on the main thread: stripped before posting
  layers: PcapLayer[];
  protocols: string[];
  info: string;
}

export interface PcapFileResult {
  name: string;
  format: 'pcap' | 'pcapng';
  linkType: number;
  tsResolution: 'us' | 'ns';
  packetCount: number;
  packets: PcapPacket[];
  error?: string;
}

const LAYER_COLORS: Record<string, string> = {
  Ethernet: '#6366f1',
  ARP: '#f59e0b',
  IPv4: '#3b82f6',
  IPv6: '#0ea5e9',
  TCP: '#10b981',
  UDP: '#14b8a6',
  ICMP: '#ec4899',
  VXLAN: '#a855f7',
  MPLS: '#f97316',
  GRE: '#fb7185',
  '802.1Q': '#8b5cf6',
  SLL: '#64748b',
  Raw: '#94a3b8',
};

function colorFor(name: string): string {
  return LAYER_COLORS[name] ?? '#94a3b8';
}

export function u16(bytes: Uint8Array, off: number): number {
  return (bytes[off] << 8) | bytes[off + 1];
}
export function u32(bytes: Uint8Array, off: number): number {
  return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
}
export function u16le(bytes: Uint8Array, off: number): number {
  return bytes[off] | (bytes[off + 1] << 8);
}
export function u32le(bytes: Uint8Array, off: number): number {
  return ((bytes[off]) | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
}

function mac(bytes: Uint8Array, off: number): string {
  return Array.from(bytes.slice(off, off + 6)).map((b) => b.toString(16).padStart(2, '0')).join(':');
}
function ipStr(bytes: Uint8Array, off: number): string {
  return Array.from(bytes.slice(off, off + 4)).join('.');
}
function ip6Str(bytes: Uint8Array, off: number): string {
  const groups: string[] = [];
  for (let i = 0; i < 8; i++) groups.push(((bytes[off + i * 2] << 8) | bytes[off + i * 2 + 1]).toString(16));
  return groups.join(':');
}

const TCP_FLAG_BITS: [number, string][] = [
  [0x80, 'C'], [0x40, 'E'], [0x20, 'U'], [0x10, 'A'], [0x08, 'P'], [0x04, 'R'], [0x02, 'S'], [0x01, 'F'],
];
function tcpFlagsStr(flags: number): string {
  let s = '';
  for (const [bit, ch] of TCP_FLAG_BITS) if (flags & bit) s += ch;
  return s || '.';
}

export const PROTO_NAMES: Record<number, string> = {
  1: 'ICMP', 6: 'TCP', 17: 'UDP', 2: 'IGMP', 47: 'GRE', 50: 'ESP', 51: 'AH', 58: 'ICMPv6', 89: 'OSPF',
};

export function wellKnownPort(port: number): string | undefined {
  const map: Record<number, string> = {
    20: 'ftp-data', 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 67: 'dhcp', 68: 'dhcp',
    80: 'http', 110: 'pop3', 123: 'ntp', 143: 'imap', 161: 'snmp', 162: 'snmp-trap', 389: 'ldap',
    443: 'https', 465: 'smtps', 4789: 'vxlan', 587: 'smtp-submission', 636: 'ldaps', 832: 'bgp',
    993: 'imaps', 995: 'pop3s', 1433: 'mssql', 1521: 'oracle', 3306: 'mysql', 3389: 'rdp',
    5432: 'postgres', 5900: 'vnc', 6379: 'redis', 8080: 'http-alt', 9092: 'kafka', 9200: 'es',
  };
  return map[port];
}

function portLabel(port: number): string {
  const name = wellKnownPort(port);
  return name ? `${port} (${name})` : String(port);
}

/**
 * Parse a single frame's bytes (after the pcap record header) into a chain of
 * layers, given the link-layer type. LINKTYPE_ETHERNET (1), LINKTYPE_RAW (101),
 * and LINKTYPE_LINUX_SLL (113) are supported; others fall back to raw bytes.
 */
export function parseLayers(linkType: number, bytes: Uint8Array): PcapLayer[] {
  const layers: PcapLayer[] = [];
  if (bytes.length === 0) return layers;

  if (linkType === 101) {
    parseIp(bytes, 0, layers);
    return layers;
  }
  if (linkType === 113) {
    // Linux cooked capture: 16-byte header. Protocol at offset 14 (2 bytes).
    if (bytes.length < 16) {
      layers.push(rawLayer(bytes, 0));
      return layers;
    }
    const proto = u16(bytes, 14);
    layers.push({
      name: 'SLL', offset: 0, length: 16,
      summary: `sll proto 0x${proto.toString(16).padStart(4, '0')}`,
      fields: { pkttype: String(u16le(bytes, 0)), hatype: String(u16le(bytes, 2)), halen: String(u16le(bytes, 4)), addr: mac(bytes, 6), proto: '0x' + proto.toString(16).padStart(4, '0') },
      color: colorFor('SLL'),
    });
    dispatchEthertype(proto, bytes, 16, layers);
    return layers;
  }
  // Default: Ethernet.
  parseEthernet(bytes, 0, layers);
  return layers;
}

function rawLayer(bytes: Uint8Array, off: number, len = bytes.length - off): PcapLayer {
  return {
    name: 'Raw', offset: off, length: len,
    summary: `${len} byte(s)`, fields: {}, color: colorFor('Raw'),
  };
}

function parseEthernet(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 14) {
    layers.push(rawLayer(bytes, off));
    return;
  }
  let ethType = u16(bytes, off + 12);
  const fields: Record<string, string> = {
    dst: mac(bytes, off), src: mac(bytes, off + 6), type: '0x' + ethType.toString(16).padStart(4, '0'),
  };
  let hdrLen = 14;
  // 802.1Q/QinQ VLAN tags may stack; key each tag by its 1-based index.
  let vlanTagIndex = 0;
  while (ethType === 0x8100 || ethType === 0x88a8) {
    if (bytes.length < off + hdrLen + 4) break;
    const tci = u16(bytes, off + hdrLen);
    ethType = u16(bytes, off + hdrLen + 2);
    fields[vlanTagIndex === 0 ? 'vlan' : `vlan${vlanTagIndex + 1}`] = String(tci & 0xfff);
    vlanTagIndex++;
    hdrLen += 4;
  }
  layers.push({
    name: 'Ethernet', offset: off, length: hdrLen,
    summary: `${mac(bytes, off + 6)} → ${mac(bytes, off)}`,
    fields, color: colorFor('Ethernet'),
  });
  dispatchEthertype(ethType, bytes, off + hdrLen, layers);
}

function dispatchEthertype(ethType: number, bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (ethType === 0x0800) parseIp(bytes, off, layers);
  else if (ethType === 0x86dd) parseIpv6(bytes, off, layers);
  else if (ethType === 0x0806) parseArp(bytes, off, layers);
  else if (ethType === 0x8847 || ethType === 0x8848) parseMpls(bytes, off, layers);
  else if (bytes.length > off) layers.push(rawLayer(bytes, off));
}

/**
 * Parse an MPLS label stack. Each shim header is 4 bytes (label 20b, TC 3b,
 * Bottom-of-Stack 1b, TTL 8b). Labels are consumed until S=1, then the next
 * header is detected by IP-version nibble (4→IPv4, 6→IPv6).
 */
function parseMpls(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
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
  if (labels.length === 0) { layers.push(rawLayer(bytes, off)); return; }
  const fields: Record<string, string> = {};
  const multi = labels.length > 1;
  labels.forEach((l, i) => {
    fields[`label${multi ? i + 1 : ''}`] = String(l.label);
    fields[`tc${multi ? i + 1 : ''}`] = String(l.tc);
    fields[`s${multi ? i + 1 : ''}`] = String(l.s);
    fields[`ttl${multi ? i + 1 : ''}`] = String(l.ttl);
  });
  layers.push({
    name: 'MPLS', offset: off, length: cur - off,
    summary: labels.map((l) => String(l.label)).join(', '),
    fields, color: colorFor('MPLS'),
  });
  if (bytes.length > cur) {
    const nibble = bytes[cur] >> 4;
    if (nibble === 4) parseIp(bytes, cur, layers);
    else if (nibble === 6) parseIpv6(bytes, cur, layers);
    else layers.push(rawLayer(bytes, cur));
  }
}

function parseIp(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 20) {
    layers.push(rawLayer(bytes, off));
    return;
  }
  const ihl = (bytes[off] & 0x0f) * 4;
  if (ihl < 20) { layers.push(rawLayer(bytes, off)); return; }
  const proto = bytes[off + 9];
  const flagsFrag = u16(bytes, off + 6);
  const src = ipStr(bytes, off + 12);
  const dst = ipStr(bytes, off + 16);
  layers.push({
    name: 'IPv4', offset: off, length: ihl,
    summary: `${src} → ${dst}`,
    fields: {
      version: '4', ihl: String(ihl / 4), tos: '0x' + bytes[off + 1].toString(16).padStart(2, '0'),
      len: String(u16(bytes, off + 2)), id: '0x' + u16(bytes, off + 4).toString(16).padStart(4, '0'),
      flags: ((flagsFrag >> 13) & 0x7).toString(2).padStart(3, '0'), frag: String(flagsFrag & 0x1fff),
      ttl: String(bytes[off + 8]), proto: String(proto), protoName: PROTO_NAMES[proto] ?? '',
      src, dst,
    },
    color: colorFor('IPv4'),
  });
  parseL4(bytes, off + ihl, proto, layers);
}

function parseIpv6(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 40) { layers.push(rawLayer(bytes, off)); return; }
  const plen = u16(bytes, off + 4);
  const nh = bytes[off + 6];
  const src = ip6Str(bytes, off + 8);
  const dst = ip6Str(bytes, off + 24);
  layers.push({
    name: 'IPv6', offset: off, length: 40,
    summary: `${src} → ${dst}`,
    fields: {
      version: '6', tc: '0x' + (((bytes[off] & 0x0f) << 4) | (bytes[off + 1] >> 4)).toString(16),
      flow: '0x' + (((bytes[off + 1] & 0x0f) << 16) | (bytes[off + 2] << 8) | bytes[off + 3]).toString(16),
      plen: String(plen), nh: String(nh), hlim: String(bytes[off + 7]), src, dst,
    },
    color: colorFor('IPv6'),
  });
  parseL4(bytes, off + 40, nh, layers);
}

function parseL4(bytes: Uint8Array, off: number, proto: number, layers: PcapLayer[]): void {
  if (proto === 6) parseTcp(bytes, off, layers);
  else if (proto === 17) parseUdp(bytes, off, layers);
  else if (proto === 1 || proto === 58) parseIcmp(bytes, off, layers, proto);
  else if (proto === 47) parseGre(bytes, off, layers);
  else if (bytes.length > off) layers.push(rawLayer(bytes, off));
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
function parseGre(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 4) { layers.push(rawLayer(bytes, off)); return; }
  const flagsVer = u16(bytes, off);
  const chksumPresent = (flagsVer & 0x8000) !== 0;
  const keyPresent = (flagsVer & 0x2000) !== 0;
  const seqPresent = (flagsVer & 0x1000) !== 0;
  const proto = u16(bytes, off + 2);
  let hdrLen = 4;
  const fields: Record<string, string> = {
    flags: '0x' + flagsVer.toString(16).padStart(4, '0'),
    proto: '0x' + proto.toString(16).padStart(4, '0'),
  };
  if (chksumPresent) { fields.cksum = '0x' + u16(bytes, off + hdrLen).toString(16).padStart(4, '0'); hdrLen += 4; }
  if (keyPresent) { fields.key = '0x' + u32(bytes, off + hdrLen).toString(16).padStart(8, '0'); hdrLen += 4; }
  if (seqPresent) { fields.seq = String(u32(bytes, off + hdrLen)); hdrLen += 4; }
  const inner = GRE_INNER[proto];
  layers.push({
    name: 'GRE', offset: off, length: hdrLen,
    summary: `proto 0x${proto.toString(16).padStart(4, '0')}`,
    fields, color: colorFor('GRE'),
  });
  const payloadOff = off + hdrLen;
  if (bytes.length <= payloadOff) return;
  if (inner === 4) parseIp(bytes, payloadOff, layers);
  else if (inner === 6) parseIpv6(bytes, payloadOff, layers);
  else if (inner === 47) parseMpls(bytes, payloadOff, layers);
  else layers.push(rawLayer(bytes, payloadOff));
}

function parseTcp(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 20) { layers.push(rawLayer(bytes, off)); return; }
  const dataOff = (bytes[off + 12] >> 4) * 4;
  const flags = bytes[off + 13];
  const sport = u16(bytes, off);
  const dport = u16(bytes, off + 2);
  layers.push({
    name: 'TCP', offset: off, length: Math.min(dataOff, bytes.length - off),
    summary: `${portLabel(sport)} → ${portLabel(dport)} [${tcpFlagsStr(flags)}] seq=${u32(bytes, off + 4)} ack=${u32(bytes, off + 8)} win=${u16(bytes, off + 14)}`,
    fields: {
      sport: String(sport), dport: String(dport), seq: String(u32(bytes, off + 4)),
      ack: String(u32(bytes, off + 8)), dataofs: String(dataOff / 4), flags: tcpFlagsStr(flags),
      window: String(u16(bytes, off + 14)), urgptr: String(u16(bytes, off + 18)),
    },
    color: colorFor('TCP'),
  });
  if (bytes.length > off + dataOff) layers.push(rawLayer(bytes, off + dataOff));
}

function parseUdp(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 8) { layers.push(rawLayer(bytes, off)); return; }
  const sport = u16(bytes, off);
  const dport = u16(bytes, off + 2);
  const len = u16(bytes, off + 4);
  layers.push({
    name: 'UDP', offset: off, length: 8,
    summary: `${portLabel(sport)} → ${portLabel(dport)} len=${len}`,
    fields: { sport: String(sport), dport: String(dport), len: String(len), chksum: '0x' + u16(bytes, off + 6).toString(16).padStart(4, '0') },
    color: colorFor('UDP'),
  });
  const payloadOff = off + 8;
  if (sport === 4789 || dport === 4789) {
    parseVxlan(bytes, payloadOff, layers);
  } else if (bytes.length > payloadOff) {
    layers.push(rawLayer(bytes, payloadOff));
  }
}

function parseVxlan(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 8) { layers.push(rawLayer(bytes, off)); return; }
  const flags = bytes[off];
  const vni = (bytes[off + 4] << 16) | (bytes[off + 5] << 8) | bytes[off + 6];
  layers.push({
    name: 'VXLAN', offset: off, length: 8,
    summary: `vni ${vni}`,
    fields: { flags: '0x' + flags.toString(16).padStart(2, '0'), vni: String(vni) },
    color: colorFor('VXLAN'),
  });
  // Inner Ethernet frame.
  parseEthernet(bytes, off + 8, layers);
}

function parseIcmp(bytes: Uint8Array, off: number, layers: PcapLayer[], proto: number): void {
  if (bytes.length < off + 8) { layers.push(rawLayer(bytes, off)); return; }
  const type = bytes[off];
  const code = bytes[off + 1];
  layers.push({
    name: proto === 58 ? 'ICMPv6' : 'ICMP', offset: off, length: 8,
    summary: `type ${type} code ${code}`,
    fields: { type: String(type), code: String(code), chksum: '0x' + u16(bytes, off + 2).toString(16).padStart(4, '0') },
    color: colorFor('ICMP'),
  });
  if (bytes.length > off + 8) layers.push(rawLayer(bytes, off + 8));
}

function parseArp(bytes: Uint8Array, off: number, layers: PcapLayer[]): void {
  if (bytes.length < off + 28) { layers.push(rawLayer(bytes, off)); return; }
  const op = u16(bytes, off + 6);
  layers.push({
    name: 'ARP', offset: off, length: 28,
    summary: op === 1 ? 'who-has ' + ipStr(bytes, off + 24) + ' tell ' + ipStr(bytes, off + 14)
      : op === 2 ? ipStr(bytes, off + 14) + ' is-at ' + mac(bytes, off + 18) : `op ${op}`,
    fields: {
      hwtype: String(u16(bytes, off)), ptype: '0x' + u16(bytes, off + 2).toString(16).padStart(4, '0'),
      hwlen: String(bytes[off + 4]), plen: String(bytes[off + 5]), op: String(op),
      hwsrc: mac(bytes, off + 8), psrc: ipStr(bytes, off + 14), hwdst: mac(bytes, off + 18), pdst: ipStr(bytes, off + 24),
    },
    color: colorFor('ARP'),
  });
}

function packetInfo(layers: PcapLayer[]): string {
  const l4 = layers.find((l) => l.name === 'TCP' || l.name === 'UDP' || l.name === 'ICMP' || l.name === 'ICMPv6' || l.name === 'ARP');
  return l4 ? l4.summary : (layers[layers.length - 1]?.summary ?? '');
}

function buildPacket(index: number, tsSec: number, tsFrac: number, nsRes: boolean, capLen: number, origLen: number, linkType: number, bytes: Uint8Array): PcapPacket {
  const layers = parseLayers(linkType, bytes);
  const protocols = layers.map((l) => l.name);
  const tsNs = tsSec * 1e9 + (nsRes ? tsFrac : tsFrac * 1000);
  return { index, tsSec, tsFrac, tsNs, capLen, origLen, bytes, layers, protocols, info: packetInfo(layers) };
}

/** Parse a classic libpcap file (microsecond or nanosecond magic). */
export function parsePcap(name: string, bytes: Uint8Array): PcapFileResult {
  if (bytes.length < 24) {
    return { name, format: 'pcap', linkType: 1, tsResolution: 'us', packetCount: 0, packets: [], error: 'File too short for a pcap global header.' };
  }
  const magic = u32(bytes, 0);
  let bigEndian: boolean;
  let nsRes: boolean;
  if (magic === 0xa1b2c3d4) { bigEndian = true; nsRes = false; }
  else if (magic === 0xd4c3b2a1) { bigEndian = false; nsRes = false; }
  else if (magic === 0xa1b23c4d) { bigEndian = true; nsRes = true; }
  else if (magic === 0x4d3cb2a1) { bigEndian = false; nsRes = true; }
  else {
    return { name, format: 'pcap', linkType: 1, tsResolution: 'us', packetCount: 0, packets: [], error: 'Not a classic pcap file (bad magic).' };
  }
  const rd32 = (off: number) => bigEndian ? u32(bytes, off) : u32le(bytes, off);
  const linkType = rd32(20);
  const packets: PcapPacket[] = [];
  let off = 24;
  let idx = 0;
  while (off + 16 <= bytes.length) {
    const tsSec = rd32(off);
    const tsFrac = rd32(off + 4);
    const incl = rd32(off + 8);
    const orig = rd32(off + 12);
    off += 16;
    if (off + incl > bytes.length) break;
    const data = bytes.slice(off, off + incl);
    off += incl;
    packets.push(buildPacket(idx++, tsSec, tsFrac, nsRes, incl, orig, linkType, data));
  }
  return { name, format: 'pcap', linkType, tsResolution: nsRes ? 'ns' : 'us', packetCount: packets.length, packets };
}

/** Parse a pcapng file (best-effort: SHB, IDB, EPB, SPB). */
export function parsePcapng(name: string, bytes: Uint8Array): PcapFileResult {
  const packets: PcapPacket[] = [];
  const interfaces: { linkType: number; tsResolNs: boolean }[] = [];
  let idx = 0;
  let off = 0;
  let error: string | undefined;
  while (off + 8 <= bytes.length) {
    const blockType = u32le(bytes, off);
    const blockLen = u32le(bytes, off + 4);
    if (blockLen < 12 || off + blockLen > bytes.length) break;
    const body = bytes.subarray(off + 8, off + blockLen - 4);
    switch (blockType) {
      case 0x0a0d0d0a: { // Section Header Block
        break;
      }
      case 0x00000001: { // Interface Description Block
        if (body.length >= 8) {
          const linkType = u16le(body, 0);
          let tsResolNs = false;
          // Options: TLV after the 8-byte fixed part. Look for if_tsresol (9).
          let optOff = 8;
          while (optOff + 4 <= body.length) {
            const optCode = u16le(body, optOff);
            const optLen = u16le(body, optOff + 2);
            if (optCode === 0) break;
            if (optCode === 9 && optLen >= 1) {
              const resol = body[optOff + 4];
              tsResolNs = (resol & 0x80) !== 0;
            }
            const padded = (optLen + 3) & ~3;
            optOff += 4 + padded;
          }
          interfaces.push({ linkType, tsResolNs });
        }
        break;
      }
      case 0x00000006: { // Enhanced Packet Block
        if (body.length >= 20) {
          const ifId = u32le(body, 0);
          const tsHigh = u32le(body, 4);
          const tsLow = u32le(body, 8);
          const capLen = u32le(body, 12);
          const data = body.subarray(20, 20 + capLen);
          const iface = interfaces[ifId];
          const tsResNs = iface ? iface.tsResolNs : false;
          const ts64 = (tsHigh * 2 ** 32 + tsLow);
          const tsSec = Math.floor(ts64 / (tsResNs ? 1e9 : 1e6));
          const tsFrac = ts64 - tsSec * (tsResNs ? 1e9 : 1e6);
          packets.push(buildPacket(idx++, tsSec, tsFrac, tsResNs, capLen, capLen, iface ? iface.linkType : 1, data.slice()));
        }
        break;
      }
      case 0x00000003: { // Simple Packet Block
        if (body.length >= 4) {
          const origLen = u32le(body, 0);
          const data = body.subarray(4);
          packets.push(buildPacket(idx++, 0, 0, false, data.length, origLen, interfaces[0]?.linkType ?? 1, data.slice()));
        }
        break;
      }
      default:
        break;
    }
    off += blockLen;
  }
  if (packets.length === 0 && !error) error = 'No Enhanced/Simple packet blocks found in this pcapng file.';
  return { name, format: 'pcapng', linkType: interfaces[0]?.linkType ?? 1, tsResolution: interfaces[0]?.tsResolNs ? 'ns' : 'us', packetCount: packets.length, packets, error };
}

/** Auto-detect and parse a pcap or pcapng file. */
export function parsePcapFile(name: string, bytes: Uint8Array): PcapFileResult {
  if (bytes.length >= 4 && u32le(bytes, 0) === 0x0a0d0d0a) return parsePcapng(name, bytes);
  return parsePcap(name, bytes);
}

// ---------------------------------------------------------------------------
// Statistics, conversations, and topology (all derived from parsed packets).
// ---------------------------------------------------------------------------

export interface PcapStats {
  packetCount: number;
  totalBytes: number;
  firstTsNs: number;
  lastTsNs: number;
  durationNs: number;
  byProto: Record<string, number>;
  byProtoBytes: Record<string, number>;
  topTalkers: { ip: string; bytes: number; packets: number }[];
  protocolList: string[];
}

export function buildStats(packets: PcapPacket[]): PcapStats {
  const byProto: Record<string, number> = {};
  const byProtoBytes: Record<string, number> = {};
  const talkers: Record<string, { bytes: number; packets: number }> = {};
  let totalBytes = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const p of packets) {
    const len = p.capLen;
    totalBytes += len;
    if (p.tsNs < first) first = p.tsNs;
    if (p.tsNs > last) last = p.tsNs;
    const topProto = p.protocols[p.protocols.length - 1] ?? 'Raw';
    byProto[topProto] = (byProto[topProto] ?? 0) + 1;
    byProtoBytes[topProto] = (byProtoBytes[topProto] ?? 0) + len;
    for (const l of p.layers) {
      if (l.name === 'IPv4' || l.name === 'IPv6') {
        const src = l.fields.src;
        const dst = l.fields.dst;
        if (src) { (talkers[src] ??= { bytes: 0, packets: 0 }).bytes += len; talkers[src].packets++; }
        if (dst) { (talkers[dst] ??= { bytes: 0, packets: 0 }).bytes += len; talkers[dst].packets++; }
      }
    }
  }
  const topTalkers = Object.entries(talkers)
    .map(([ip, v]) => ({ ip, bytes: v.bytes, packets: v.packets }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);
  return {
    packetCount: packets.length,
    totalBytes,
    firstTsNs: first === Infinity ? 0 : first,
    lastTsNs: last === -Infinity ? 0 : last,
    durationNs: first === Infinity ? 0 : Math.max(0, last - first),
    byProto, byProtoBytes, topTalkers,
    protocolList: Object.keys(byProto).sort((a, b) => byProto[b] - byProto[a]),
  };
}

export interface Conversation {
  key: string;
  src: string;
  dst: string;
  proto: string;
  sport: number | undefined;
  dport: number | undefined;
  packets: number[];
  bytes: number;
}

/** Group packets into directional conversations keyed by endpoint pair + L4. */
export function buildConversations(packets: PcapPacket[]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const p of packets) {
    const ip = p.layers.find((l) => l.name === 'IPv4' || l.name === 'IPv6');
    const l4 = p.layers.find((l) => l.name === 'TCP' || l.name === 'UDP');
    if (!ip) continue;
    const src = ip.fields.src;
    const dst = ip.fields.dst;
    if (!src || !dst) continue;
    const proto = l4?.name || ip.fields.protoName || (ip.name === 'IPv6' ? 'IPv6' : 'IPv4');
    const sport = l4 ? Number(l4.fields.sport) : undefined;
    const dport = l4 ? Number(l4.fields.dport) : undefined;
    const key = `${src}->${dst}|${proto}|${sport ?? ''}-${dport ?? ''}`;
    let c = map.get(key);
    if (!c) {
      c = { key, src, dst, proto, sport, dport, packets: [], bytes: 0 };
      map.set(key, c);
    }
    c.packets.push(p.index);
    c.bytes += p.capLen;
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes);
}

export interface TopologyNode {
  id: string;
  label: string;
  bytes: number;
  packets: number;
}
export interface TopologyEdge {
  a: string;
  b: string;
  bytes: number;
  packets: number;
  proto: string;
}
export interface Topology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

/** Build an undirected endpoint graph (IP nodes, conversation edges). */
export function buildTopology(conversations: Conversation[]): Topology {
  const nodes = new Map<string, TopologyNode>();
  const edgeMap = new Map<string, TopologyEdge>();
  const upsertNode = (ip: string) => {
    let n = nodes.get(ip);
    if (!n) { n = { id: ip, label: ip, bytes: 0, packets: 0 }; nodes.set(ip, n); }
    return n;
  };
  for (const c of conversations) {
    const na = upsertNode(c.src);
    const nb = upsertNode(c.dst);
    na.bytes += c.bytes; na.packets += c.packets.length;
    nb.bytes += c.bytes; nb.packets += c.packets.length;
    const [a, b] = c.src < c.dst ? [c.src, c.dst] : [c.dst, c.src];
    const ek = `${a}|${b}`;
    let e = edgeMap.get(ek);
    if (!e) { e = { a, b, bytes: 0, packets: 0, proto: c.proto }; edgeMap.set(ek, e); }
    e.bytes += c.bytes;
    e.packets += c.packets.length;
  }
  return {
    nodes: [...nodes.values()].sort((x, y) => y.bytes - x.bytes),
    edges: [...edgeMap.values()].sort((x, y) => y.bytes - x.bytes),
  };
}

/** Bytes formatted for human display. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** Nanosecond duration formatted as h/m/s/ms. */
export function formatDuration(ns: number): string {
  const ms = ns / 1e6;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s - m * 60).toFixed(1)}s`;
}
