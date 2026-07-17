/** Pure IPv4/IPv6 address and subnet utilities (client-side only). */

export type IpVersion = 4 | 6;

export interface ParsedIp {
  version: IpVersion;
  /** Canonical string form (compressed IPv6, dotted IPv4). */
  address: string;
  /** Fully expanded form. */
  expanded: string;
  /** 32-bit or 128-bit unsigned integer as BigInt. */
  value: bigint;
  /** Hex without separators (8 or 32 hex digits). */
  hex: string;
  /** Binary string (32 or 128 bits). */
  binary: string;
  /** Decimal string of the integer value. */
  decimal: string;
}

export interface ParsedCidr {
  version: IpVersion;
  /** Network address (host bits cleared). */
  network: string;
  prefix: number;
  /** Dotted decimal mask (IPv4 only) or hex-like mask for v6. */
  netmask: string;
  /** Wildcard / host mask (IPv4 only). */
  wildcard?: string;
  /** Broadcast (IPv4) or last address of the prefix (IPv6). */
  broadcast: string;
  firstHost: string;
  lastHost: string;
  /** Total addresses in the block (2^(bits-prefix)). */
  totalAddresses: bigint;
  /** Usable hosts: IPv4 /31-/32 and all IPv6 use special rules. */
  usableHosts: bigint;
  networkValue: bigint;
  broadcastValue: bigint;
  cidr: string;
}

export type AddressKind =
  | 'unspecified'
  | 'loopback'
  | 'private'
  | 'unique-local'
  | 'link-local'
  | 'multicast'
  | 'broadcast'
  | 'documentation'
  | 'cgnat'
  | 'benchmark'
  | 'reserved'
  | 'global'
  | 'ipv4-mapped'
  | 'ipv4-compatible'
  | '6to4'
  | 'teredo'
  | 'discard';

export interface Classification {
  kinds: AddressKind[];
  /** Legacy classful class for IPv4 only. */
  classful?: 'A' | 'B' | 'C' | 'D' | 'E';
  summary: string;
}

export interface SpecialRange {
  cidr: string;
  name: string;
  rfc?: string;
  description: string;
}

export const HOST_LIST_CAP = 256;
export const SPLIT_LIST_CAP = 1024;

const V4_MAX = (1n << 32n) - 1n;
const V6_MAX = (1n << 128n) - 1n;

export function isValidIpv4(input: string): boolean {
  return parseIpv4(input) !== null;
}

export function isValidIpv6(input: string): boolean {
  return parseIpv6(input) !== null;
}

export function detectVersion(input: string): IpVersion | null {
  const s = input.trim();
  if (!s) return null;
  if (s.includes(':')) return isValidIpv6(s) ? 6 : null;
  return isValidIpv4(s) ? 4 : null;
}

/** Parse a bare IP address (no CIDR). */
export function parseIp(input: string): ParsedIp {
  const s = input.trim();
  if (!s) throw new Error('Enter an IP address.');
  if (s.includes('/')) throw new Error('Use a bare address here, not CIDR notation.');

  if (s.includes(':')) {
    const v = parseIpv6(s);
    if (v === null) throw new Error(`Invalid IPv6 address: ${s}`);
    return buildParsed(6, v);
  }
  const v = parseIpv4(s);
  if (v === null) throw new Error(`Invalid IPv4 address: ${s}`);
  return buildParsed(4, v);
}

/** Parse CIDR or IP alone (defaults to /32 or /128). */
export function parseCidr(input: string): ParsedCidr {
  const s = input.trim();
  if (!s) throw new Error('Enter an IP or CIDR.');

  let addrPart = s;
  let prefix: number | null = null;
  const slash = s.lastIndexOf('/');
  if (slash >= 0) {
    addrPart = s.slice(0, slash).trim();
    const p = s.slice(slash + 1).trim();
    if (!/^\d+$/.test(p)) throw new Error('Prefix length must be an integer.');
    prefix = parseInt(p, 10);
  }

  const isV6 = addrPart.includes(':');
  const bits = isV6 ? 128 : 32;
  if (prefix === null) prefix = bits;
  if (prefix < 0 || prefix > bits) {
    throw new Error(`Prefix must be between 0 and ${bits}.`);
  }

  const value = isV6 ? parseIpv6(addrPart) : parseIpv4(addrPart);
  if (value === null) {
    throw new Error(`Invalid ${isV6 ? 'IPv6' : 'IPv4'} address: ${addrPart}`);
  }

  return buildCidr(isV6 ? 6 : 4, value, prefix);
}

export function formatIp(version: IpVersion, value: bigint, style: 'canonical' | 'expanded' = 'canonical'): string {
  if (version === 4) return formatIpv4(value);
  return style === 'expanded' ? formatIpv6Expanded(value) : formatIpv6Compressed(value);
}

export function prefixToNetmask(version: IpVersion, prefix: number): string {
  const bits = version === 4 ? 32 : 128;
  if (prefix < 0 || prefix > bits) throw new Error(`Prefix must be 0–${bits}.`);
  const mask = prefix === 0 ? 0n : ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n);
  if (version === 4) return formatIpv4(mask);
  return formatIpv6Compressed(mask);
}

export function netmaskToPrefix(mask: string): number {
  const s = mask.trim();
  if (s.includes(':')) {
    const v = parseIpv6(s);
    if (v === null) throw new Error(`Invalid IPv6 netmask: ${s}`);
    return maskValueToPrefix(v, 128);
  }
  const v = parseIpv4(s);
  if (v === null) throw new Error(`Invalid IPv4 netmask: ${s}`);
  return maskValueToPrefix(v, 32);
}

export function prefixToWildcard(prefix: number): string {
  if (prefix < 0 || prefix > 32) throw new Error('Prefix must be 0–32 for IPv4 wildcard.');
  const hostBits = 32 - prefix;
  const wild = hostBits === 32 ? V4_MAX : (1n << BigInt(hostBits)) - 1n;
  return formatIpv4(wild);
}

export function ipInCidr(ipInput: string, cidrInput: string): boolean {
  const ip = parseIp(ipInput);
  const cidr = parseCidr(cidrInput);
  if (ip.version !== cidr.version) {
    throw new Error('Address and CIDR must be the same IP version.');
  }
  return ip.value >= cidr.networkValue && ip.value <= cidr.broadcastValue;
}

export function classifyAddress(input: string): Classification {
  const ip = parseIp(input);
  const kinds: AddressKind[] = [];

  if (ip.version === 4) {
    const o = Number((ip.value >> 24n) & 0xffn);
    if (ip.value === 0n) kinds.push('unspecified');
    if (ip.value === V4_MAX) kinds.push('broadcast');
    if (o === 127) kinds.push('loopback');
    if (o === 10) kinds.push('private');
    if (o === 172 && Number((ip.value >> 16n) & 0xffn) >= 16 && Number((ip.value >> 16n) & 0xffn) <= 31) {
      kinds.push('private');
    }
    if (o === 192 && Number((ip.value >> 16n) & 0xffn) === 168) kinds.push('private');
    if (o === 169 && Number((ip.value >> 16n) & 0xffn) === 254) kinds.push('link-local');
    if (o >= 224 && o <= 239) kinds.push('multicast');
    if (o >= 240) kinds.push('reserved');
    // CGNAT 100.64.0.0/10
    if (o === 100 && Number((ip.value >> 16n) & 0xffn) >= 64 && Number((ip.value >> 16n) & 0xffn) <= 127) {
      kinds.push('cgnat');
    }
    // Documentation 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
    if (
      (o === 192 && Number((ip.value >> 16n) & 0xffn) === 0 && Number((ip.value >> 8n) & 0xffn) === 2) ||
      (o === 198 && Number((ip.value >> 16n) & 0xffn) === 51 && Number((ip.value >> 8n) & 0xffn) === 100) ||
      (o === 203 && Number((ip.value >> 16n) & 0xffn) === 0 && Number((ip.value >> 8n) & 0xffn) === 113)
    ) {
      kinds.push('documentation');
    }
    // Benchmark 198.18.0.0/15
    if (o === 198 && Number((ip.value >> 16n) & 0xffn) >= 18 && Number((ip.value >> 16n) & 0xffn) <= 19) {
      kinds.push('benchmark');
    }
    // 0.0.0.0/8 remaining
    if (o === 0 && ip.value !== 0n) kinds.push('reserved');

    let classful: Classification['classful'];
    if (o < 128) classful = 'A';
    else if (o < 192) classful = 'B';
    else if (o < 224) classful = 'C';
    else if (o < 240) classful = 'D';
    else classful = 'E';

    if (kinds.length === 0) kinds.push('global');
    return {
      kinds: unique(kinds),
      classful,
      summary: summarizeKinds(unique(kinds), classful),
    };
  }

  // IPv6
  if (ip.value === 0n) kinds.push('unspecified');
  if (ip.value === 1n) kinds.push('loopback');
  // fe80::/10
  if ((ip.value >> 118n) === 0x3fan) kinds.push('link-local');
  // fc00::/7 ULA
  if ((ip.value >> 121n) === 0x7en) kinds.push('unique-local');
  // ff00::/8
  if ((ip.value >> 120n) === 0xffn) kinds.push('multicast');
  // 2001:db8::/32 documentation
  if ((ip.value >> 96n) === 0x20010db8n) kinds.push('documentation');
  // 2001:2::/48 benchmarking
  if ((ip.value >> 80n) === 0x200100020000n) kinds.push('benchmark');
  // 100::/64 discard
  if ((ip.value >> 64n) === 0x100n) kinds.push('discard');
  // ::ffff:0:0/96 IPv4-mapped
  if ((ip.value >> 32n) === 0xffffn) kinds.push('ipv4-mapped');
  // ::/96 IPv4-compatible (deprecated), exclude :: and ::1
  if ((ip.value >> 32n) === 0n && ip.value > 1n) kinds.push('ipv4-compatible');
  // 2002::/16 6to4
  if ((ip.value >> 112n) === 0x2002n) kinds.push('6to4');
  // 2001:0000::/32 Teredo
  if ((ip.value >> 96n) === 0x20010000n) kinds.push('teredo');
  // 2001:10::/28 ORCHID (reserved-ish)
  if ((ip.value >> 100n) === 0x20010n) kinds.push('reserved');

  if (kinds.length === 0) kinds.push('global');
  return { kinds: unique(kinds), summary: summarizeKinds(unique(kinds)) };
}

export function ipv4ToMapped(ipv4: string): string {
  const v = parseIpv4(ipv4.trim());
  if (v === null) throw new Error(`Invalid IPv4 address: ${ipv4}`);
  return formatIpv6Compressed((0xffffn << 32n) | v);
}

export function mappedToIpv4(ipv6: string): string {
  const ip = parseIp(ipv6);
  if (ip.version !== 6) throw new Error('Expected an IPv6 address.');
  if ((ip.value >> 32n) !== 0xffffn) {
    throw new Error('Not an IPv4-mapped address (::ffff:0:0/96).');
  }
  return formatIpv4(ip.value & V4_MAX);
}

export function decode6to4(ipv6: string): { ipv4: string; prefix: string } {
  const ip = parseIp(ipv6);
  if (ip.version !== 6) throw new Error('Expected an IPv6 address.');
  if ((ip.value >> 112n) !== 0x2002n) throw new Error('Not a 6to4 address (2002::/16).');
  const v4 = (ip.value >> 80n) & V4_MAX;
  return { ipv4: formatIpv4(v4), prefix: `2002:${formatIpv4AsHexGroups(v4)}::/48` };
}

export function encode6to4(ipv4: string): string {
  const v = parseIpv4(ipv4.trim());
  if (v === null) throw new Error(`Invalid IPv4 address: ${ipv4}`);
  return formatIpv6Compressed((0x2002n << 112n) | (v << 80n));
}

/** Decode Teredo (2001:0000::/32) into server/client IPv4 and obfuscated port. */
export function decodeTeredo(ipv6: string): {
  serverIpv4: string;
  clientIpv4: string;
  udpPort: number;
  flags: number;
} {
  const ip = parseIp(ipv6);
  if (ip.version !== 6) throw new Error('Expected an IPv6 address.');
  if ((ip.value >> 96n) !== 0x20010000n) throw new Error('Not a Teredo address (2001:0000::/32).');
  // Layout: 2001:0000 | server IPv4 | flags | port^0xffff | client IPv4^0xffffffff
  const serverIpv4Val = (ip.value >> 64n) & V4_MAX;
  const flags = Number((ip.value >> 48n) & 0xffffn);
  const portObf = Number((ip.value >> 32n) & 0xffffn);
  const clientObf = ip.value & V4_MAX;
  return {
    serverIpv4: formatIpv4(serverIpv4Val),
    clientIpv4: formatIpv4(clientObf ^ V4_MAX),
    udpPort: portObf ^ 0xffff,
    flags,
  };
}

export function distance(a: string, b: string): bigint {
  const ia = parseIp(a);
  const ib = parseIp(b);
  if (ia.version !== ib.version) throw new Error('Both addresses must be the same IP version.');
  return ia.value > ib.value ? ia.value - ib.value : ib.value - ia.value;
}

export function sameSubnet(a: string, b: string, prefix: number): boolean {
  const ia = parseIp(a);
  const ib = parseIp(b);
  if (ia.version !== ib.version) throw new Error('Both addresses must be the same IP version.');
  const bits = ia.version === 4 ? 32 : 128;
  if (prefix < 0 || prefix > bits) throw new Error(`Prefix must be 0–${bits}.`);
  const shift = BigInt(bits - prefix);
  const mask = prefix === 0 ? 0n : ((1n << BigInt(bits)) - 1n) ^ ((1n << shift) - 1n);
  return (ia.value & mask) === (ib.value & mask);
}

/** List addresses in a CIDR, capped. */
export function expandCidr(
  cidrInput: string,
  cap = HOST_LIST_CAP,
): { addresses: string[]; total: bigint; truncated: boolean } {
  const c = parseCidr(cidrInput);
  const total = c.totalAddresses;
  const n = total > BigInt(cap) ? cap : Number(total);
  const addresses: string[] = [];
  for (let i = 0; i < n; i++) {
    addresses.push(formatIp(c.version, c.networkValue + BigInt(i)));
  }
  return { addresses, total, truncated: total > BigInt(cap) };
}

/** Split a CIDR into smaller equal prefixes. */
export function splitCidr(
  cidrInput: string,
  newPrefix: number,
  cap = SPLIT_LIST_CAP,
): { subnets: string[]; total: bigint; truncated: boolean } {
  const c = parseCidr(cidrInput);
  const bits = c.version === 4 ? 32 : 128;
  if (newPrefix < c.prefix || newPrefix > bits) {
    throw new Error(`New prefix must be between ${c.prefix} and ${bits}.`);
  }
  const count = 1n << BigInt(newPrefix - c.prefix);
  const step = 1n << BigInt(bits - newPrefix);
  const n = count > BigInt(cap) ? cap : Number(count);
  const subnets: string[] = [];
  for (let i = 0; i < n; i++) {
    const net = c.networkValue + step * BigInt(i);
    subnets.push(`${formatIp(c.version, net)}/${newPrefix}`);
  }
  return { subnets, total: count, truncated: count > BigInt(cap) };
}

/** Summarize contiguous CIDRs of the same version into fewer prefixes. */
export function summarizeCidrs(inputs: string[]): string[] {
  const parsed = inputs.map((s) => parseCidr(s.trim())).filter(Boolean);
  if (parsed.length === 0) return [];
  const version = parsed[0].version;
  if (parsed.some((p) => p.version !== version)) {
    throw new Error('All CIDRs must be the same IP version.');
  }

  // Expand to list of [start, end] ranges, merge, then range-to-cidr
  const ranges = parsed
    .map((p) => ({ start: p.networkValue, end: p.broadcastValue }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const merged: { start: bigint; end: bigint }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r.start > last.end + 1n) {
      merged.push({ ...r });
    } else if (r.end > last.end) {
      last.end = r.end;
    }
  }

  const out: string[] = [];
  for (const r of merged) {
    out.push(...rangeToCidrs(version, r.start, r.end));
  }
  return out;
}

/** Collapse an inclusive IP range into minimal CIDRs. */
export function rangeToCidrList(startInput: string, endInput: string): string[] {
  const a = parseIp(startInput);
  const b = parseIp(endInput);
  if (a.version !== b.version) throw new Error('Start and end must be the same IP version.');
  const start = a.value <= b.value ? a.value : b.value;
  const end = a.value <= b.value ? b.value : a.value;
  return rangeToCidrs(a.version, start, end);
}

export function randomInCidr(cidrInput: string, rng: () => number = Math.random): string {
  const c = parseCidr(cidrInput);
  if (c.totalAddresses === 1n) return c.network;
  // Sample uniformly using rejection for large spaces via 53-bit chunks
  const hostBits = (c.version === 4 ? 32 : 128) - c.prefix;
  if (hostBits <= 0) return c.network;
  let offset = 0n;
  let remaining = hostBits;
  while (remaining > 0) {
    const take = Math.min(remaining, 48);
    const max = 2 ** take;
    const r = Math.floor(rng() * max);
    offset = (offset << BigInt(take)) | BigInt(r);
    remaining -= take;
  }
  // clamp into range
  const span = c.totalAddresses;
  offset = offset % span;
  return formatIp(c.version, c.networkValue + offset);
}

/** MAC (EUI-48) → IPv6 link-local via modified EUI-64. */
export function macToLinkLocal(mac: string): string {
  const bytes = parseMac(mac);
  // Insert ff:fe and flip U/L bit
  const eui = [
    bytes[0] ^ 0x02,
    bytes[1],
    bytes[2],
    0xff,
    0xfe,
    bytes[3],
    bytes[4],
    bytes[5],
  ];
  let iface = 0n;
  for (const b of eui) iface = (iface << 8n) | BigInt(b);
  const value = (0xfe80n << 112n) | iface;
  return formatIpv6Compressed(value);
}

export function parseMac(mac: string): number[] {
  const s = mac.trim();
  const parts = s.split(/[:\-.]/).filter(Boolean);
  let hex: string[];
  if (parts.length === 6) {
    hex = parts;
  } else if (parts.length === 3 && parts.every((p) => p.length === 4)) {
    // Cisco xxxx.xxxx.xxxx
    hex = parts.flatMap((p) => [p.slice(0, 2), p.slice(2, 4)]);
  } else if (/^[0-9a-fA-F]{12}$/.test(s.replace(/[^0-9a-fA-F]/g, '')) && s.replace(/[^0-9a-fA-F]/g, '').length === 12) {
    const clean = s.replace(/[^0-9a-fA-F]/g, '');
    hex = Array.from({ length: 6 }, (_, i) => clean.slice(i * 2, i * 2 + 2));
  } else {
    throw new Error('Invalid MAC address. Use aa:bb:cc:dd:ee:ff or similar.');
  }
  if (hex.length !== 6 || hex.some((h) => !/^[0-9a-fA-F]{1,2}$/.test(h))) {
    throw new Error('Invalid MAC address.');
  }
  return hex.map((h) => parseInt(h, 16));
}

export function batchProcess(
  lines: string,
  options: { checkCidr?: string } = {},
): Array<{
  line: string;
  ok: boolean;
  error?: string;
  version?: IpVersion;
  address?: string;
  classification?: Classification;
  inCidr?: boolean;
}> {
  const rows = lines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  return rows.map((line) => {
    try {
      const hasCidr = line.includes('/');
      if (hasCidr) {
        const c = parseCidr(line);
        const classification = classifyAddress(c.network);
        const row: ReturnType<typeof batchProcess>[number] = {
          line,
          ok: true,
          version: c.version,
          address: c.cidr,
          classification,
        };
        if (options.checkCidr) {
          try {
            row.inCidr = ipInCidr(c.network, options.checkCidr);
          } catch {
            row.inCidr = false;
          }
        }
        return row;
      }
      const ip = parseIp(line);
      const classification = classifyAddress(ip.address);
      const row: ReturnType<typeof batchProcess>[number] = {
        line,
        ok: true,
        version: ip.version,
        address: ip.address,
        classification,
      };
      if (options.checkCidr) {
        try {
          row.inCidr = ipInCidr(ip.address, options.checkCidr);
        } catch {
          row.inCidr = false;
        }
      }
      return row;
    } catch (e) {
      return { line, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}

export const SPECIAL_RANGES: SpecialRange[] = [
  { cidr: '0.0.0.0/8', name: 'This network', rfc: 'RFC 1122', description: 'Self-identification / current network' },
  { cidr: '10.0.0.0/8', name: 'Private', rfc: 'RFC 1918', description: 'Private use' },
  { cidr: '100.64.0.0/10', name: 'CGNAT', rfc: 'RFC 6598', description: 'Carrier-grade NAT shared address space' },
  { cidr: '127.0.0.0/8', name: 'Loopback', rfc: 'RFC 1122', description: 'Host loopback' },
  { cidr: '169.254.0.0/16', name: 'Link-local', rfc: 'RFC 3927', description: 'APIPA / link-local' },
  { cidr: '172.16.0.0/12', name: 'Private', rfc: 'RFC 1918', description: 'Private use' },
  { cidr: '192.0.0.0/24', name: 'IETF protocol', rfc: 'RFC 6890', description: 'IETF protocol assignments' },
  { cidr: '192.0.2.0/24', name: 'Documentation', rfc: 'RFC 5737', description: 'TEST-NET-1 documentation' },
  { cidr: '192.168.0.0/16', name: 'Private', rfc: 'RFC 1918', description: 'Private use' },
  { cidr: '198.18.0.0/15', name: 'Benchmark', rfc: 'RFC 2544', description: 'Network interconnect device benchmark' },
  { cidr: '198.51.100.0/24', name: 'Documentation', rfc: 'RFC 5737', description: 'TEST-NET-2 documentation' },
  { cidr: '203.0.113.0/24', name: 'Documentation', rfc: 'RFC 5737', description: 'TEST-NET-3 documentation' },
  { cidr: '224.0.0.0/4', name: 'Multicast', rfc: 'RFC 5771', description: 'IPv4 multicast' },
  { cidr: '240.0.0.0/4', name: 'Reserved', rfc: 'RFC 1112', description: 'Reserved for future use (class E)' },
  { cidr: '255.255.255.255/32', name: 'Limited broadcast', rfc: 'RFC 919', description: 'Limited broadcast' },
  { cidr: '::/128', name: 'Unspecified', rfc: 'RFC 4291', description: 'Unspecified address' },
  { cidr: '::1/128', name: 'Loopback', rfc: 'RFC 4291', description: 'Loopback' },
  { cidr: '::ffff:0:0/96', name: 'IPv4-mapped', rfc: 'RFC 4291', description: 'IPv4-mapped IPv6' },
  { cidr: '64:ff9b::/96', name: 'NAT64', rfc: 'RFC 6052', description: 'Well-known NAT64 prefix' },
  { cidr: '100::/64', name: 'Discard', rfc: 'RFC 6666', description: 'Discard-only prefix' },
  { cidr: '2001::/32', name: 'Teredo', rfc: 'RFC 4380', description: 'Teredo tunneling' },
  { cidr: '2001:2::/48', name: 'Benchmark', rfc: 'RFC 5180', description: 'Benchmarking' },
  { cidr: '2001:db8::/32', name: 'Documentation', rfc: 'RFC 3849', description: 'Documentation' },
  { cidr: '2002::/16', name: '6to4', rfc: 'RFC 3056', description: '6to4' },
  { cidr: 'fc00::/7', name: 'ULA', rfc: 'RFC 4193', description: 'Unique local addresses' },
  { cidr: 'fe80::/10', name: 'Link-local', rfc: 'RFC 4291', description: 'Link-local unicast' },
  { cidr: 'ff00::/8', name: 'Multicast', rfc: 'RFC 4291', description: 'IPv6 multicast' },
];

export const EXTERNAL_LINKS = [
  {
    name: 'WHOIS lookup',
    url: 'https://who.is/',
    description: 'Ownership and registration data (needs the network).',
  },
  {
    name: 'RDAP (RIPE)',
    url: 'https://rdap.db.ripe.net/',
    description: 'Modern registration data access protocol.',
  },
  {
    name: 'IP geolocation',
    url: 'https://ipinfo.io/',
    description: 'Approximate country/city from public databases.',
  },
  {
    name: 'Reverse DNS',
    url: 'https://dnschecker.org/reverse-dns.php',
    description: 'PTR record lookup for an IP.',
  },
  {
    name: 'BGP / routing',
    url: 'https://bgp.he.net/',
    description: 'AS paths and prefix announcements.',
  },
] as const;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildParsed(version: IpVersion, value: bigint): ParsedIp {
  const bits = version === 4 ? 32 : 128;
  const hexWidth = version === 4 ? 8 : 32;
  const address = formatIp(version, value, 'canonical');
  const expanded = formatIp(version, value, 'expanded');
  const hex = value.toString(16).padStart(hexWidth, '0');
  const binary = value.toString(2).padStart(bits, '0');
  return { version, address, expanded, value, hex, binary, decimal: value.toString(10) };
}

function buildCidr(version: IpVersion, value: bigint, prefix: number): ParsedCidr {
  const bits = version === 4 ? 32 : 128;
  const hostBits = bits - prefix;
  const hostMask = hostBits === bits ? (version === 4 ? V4_MAX : V6_MAX) : (1n << BigInt(hostBits)) - 1n;
  const netMask = (version === 4 ? V4_MAX : V6_MAX) ^ hostMask;
  const networkValue = value & netMask;
  const broadcastValue = networkValue | hostMask;
  const totalAddresses = 1n << BigInt(hostBits);

  let usableHosts: bigint;
  if (version === 4) {
    if (prefix >= 31) usableHosts = totalAddresses; // point-to-point / host
    else usableHosts = totalAddresses >= 2n ? totalAddresses - 2n : 0n;
  } else {
    usableHosts = totalAddresses; // no traditional broadcast
  }

  const network = formatIp(version, networkValue);
  const broadcast = formatIp(version, broadcastValue);

  let firstHost: string;
  let lastHost: string;
  if (version === 4 && prefix < 31) {
    firstHost = formatIp(4, networkValue + 1n);
    lastHost = formatIp(4, broadcastValue - 1n);
  } else {
    firstHost = network;
    lastHost = broadcast;
  }

  return {
    version,
    network,
    prefix,
    netmask: prefixToNetmask(version, prefix),
    wildcard: version === 4 ? prefixToWildcard(prefix) : undefined,
    broadcast,
    firstHost,
    lastHost,
    totalAddresses,
    usableHosts,
    networkValue,
    broadcastValue,
    cidr: `${network}/${prefix}`,
  };
}

function parseIpv4(input: string): bigint | null {
  const s = input.trim();
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    if (p.length > 1 && p.startsWith('0')) return null; // no octal-looking leading zeros
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

function parseIpv6(input: string): bigint | null {
  let s = input.trim();
  if (!s || s.includes(':::')) return null;

  // Strip zone id (fe80::1%eth0)
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);

  // IPv4 tail: ::ffff:192.0.2.1
  let v4Tail: bigint | null = null;
  const lastColon = s.lastIndexOf(':');
  if (s.includes('.') && lastColon >= 0) {
    const tail = s.slice(lastColon + 1);
    v4Tail = parseIpv4(tail);
    if (v4Tail === null) return null;
    const hi = Number((v4Tail >> 16n) & 0xffffn).toString(16);
    const lo = Number(v4Tail & 0xffffn).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const sides = s.split('::');
  if (sides.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (side === '') return [];
    const groups = side.split(':');
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  let groups: number[];
  if (sides.length === 1) {
    const g = parseSide(sides[0]);
    if (!g || g.length !== 8) return null;
    groups = g;
  } else {
    const left = parseSide(sides[0]);
    const right = parseSide(sides[1]);
    if (!left || !right) return null;
    const missing = 8 - left.length - right.length;
    if (missing < 1 && !(left.length === 0 && right.length === 0)) {
      // :: alone is ok (all zeros) → missing 8
      if (left.length + right.length !== 0) return null;
    }
    const zeros = Math.max(0, 8 - left.length - right.length);
    if (left.length + right.length + zeros !== 8) return null;
    groups = [...left, ...Array(zeros).fill(0), ...right];
  }

  let value = 0n;
  for (const g of groups) value = (value << 16n) | BigInt(g);
  void v4Tail;
  return value;
}

function formatIpv4(value: bigint): string {
  const v = value & V4_MAX;
  return [
    Number((v >> 24n) & 0xffn),
    Number((v >> 16n) & 0xffn),
    Number((v >> 8n) & 0xffn),
    Number(v & 0xffn),
  ].join('.');
}

function formatIpv6Expanded(value: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const g = Number((value >> BigInt(i * 16)) & 0xffffn);
    groups.push(g.toString(16).padStart(4, '0'));
  }
  return groups.join(':');
}

function formatIpv6Compressed(value: bigint): string {
  const groups: number[] = [];
  for (let i = 7; i >= 0; i--) {
    groups.push(Number((value >> BigInt(i * 16)) & 0xffffn));
  }

  // Find longest run of zeros
  let bestStart = -1;
  let bestLen = 0;
  let i = 0;
  while (i < 8) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    const len = j - i;
    if (len > bestLen) {
      bestStart = i;
      bestLen = len;
    }
    i = j;
  }

  const hex = groups.map((g) => g.toString(16));
  if (bestLen < 2) return hex.join(':');

  const head = hex.slice(0, bestStart).join(':');
  const tail = hex.slice(bestStart + bestLen).join(':');
  if (bestStart === 0 && bestStart + bestLen === 8) return '::';
  if (bestStart === 0) return `::${tail}`;
  if (bestStart + bestLen === 8) return `${head}::`;
  return `${head}::${tail}`;
}

function formatIpv4AsHexGroups(v: bigint): string {
  const hi = Number((v >> 16n) & 0xffffn).toString(16);
  const lo = Number(v & 0xffffn).toString(16);
  return `${hi}:${lo}`;
}

function maskValueToPrefix(mask: bigint, bits: number): number {
  // Must be contiguous 1s then 0s
  let seenZero = false;
  let prefix = 0;
  for (let i = bits - 1; i >= 0; i--) {
    const bit = (mask >> BigInt(i)) & 1n;
    if (bit === 1n) {
      if (seenZero) throw new Error('Netmask bits must be contiguous.');
      prefix++;
    } else {
      seenZero = true;
    }
  }
  return prefix;
}

function rangeToCidrs(version: IpVersion, start: bigint, end: bigint): string[] {
  const bits = version === 4 ? 32 : 128;
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    // largest power-of-two block aligned at cur that fits in [cur, end]
    let maxSizeBits = 0;
    if (cur === 0n) {
      maxSizeBits = bits;
    } else {
      // trailing zeros of cur = alignment
      let t = cur;
      while ((t & 1n) === 0n && maxSizeBits < bits) {
        t >>= 1n;
        maxSizeBits++;
      }
    }
    const remaining = end - cur + 1n;
    let spanBits = 0;
    while (spanBits < bits && 1n << BigInt(spanBits + 1) <= remaining) spanBits++;
    const take = Math.min(maxSizeBits, spanBits);
    const prefix = bits - take;
    out.push(`${formatIp(version, cur)}/${prefix}`);
    cur += 1n << BigInt(take);
  }
  return out;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function summarizeKinds(kinds: AddressKind[], classful?: Classification['classful']): string {
  const parts = kinds.map((k) => k.replace(/-/g, ' '));
  let s = parts.join(', ');
  if (classful) s += ` (legacy class ${classful})`;
  return s;
}

