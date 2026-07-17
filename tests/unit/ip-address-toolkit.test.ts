import { describe, it, expect } from 'vitest';
import {
  batchProcess,
  classifyAddress,
  decode6to4,
  decodeTeredo,
  detectVersion,
  distance,
  encode6to4,
  expandCidr,
  ipInCidr,
  isValidIpv4,
  isValidIpv6,
  ipv4ToMapped,
  macToLinkLocal,
  mappedToIpv4,
  netmaskToPrefix,
  parseCidr,
  parseIp,
  parseMac,
  prefixToNetmask,
  prefixToWildcard,
  randomInCidr,
  rangeToCidrList,
  sameSubnet,
  splitCidr,
  summarizeCidrs,
} from '../../src/tools/dev/ip-address-toolkit/ip';

describe('parseIp / validate', () => {
  it('parses dotted IPv4', () => {
    const ip = parseIp('192.0.2.1');
    expect(ip.version).toBe(4);
    expect(ip.address).toBe('192.0.2.1');
    expect(ip.decimal).toBe(String(192 * 2 ** 24 + 2 * 2 ** 8 + 1));
  });

  it('rejects leading zeros in IPv4 octets', () => {
    expect(() => parseIp('192.168.01.1')).toThrow();
  });

  it('rejects out-of-range octets', () => {
    expect(() => parseIp('256.0.0.1')).toThrow();
  });

  it('parses compressed IPv6', () => {
    const ip = parseIp('2001:db8::1');
    expect(ip.version).toBe(6);
    expect(ip.address).toBe('2001:db8::1');
    expect(ip.expanded).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
  });

  it('parses IPv6 with IPv4 tail', () => {
    const ip = parseIp('::ffff:192.0.2.1');
    expect(ip.version).toBe(6);
    expect(ip.address).toBe('::ffff:c000:201');
  });

  it('strips zone id', () => {
    const ip = parseIp('fe80::1%eth0');
    expect(ip.address).toBe('fe80::1');
  });

  it('detects version', () => {
    expect(detectVersion('1.2.3.4')).toBe(4);
    expect(detectVersion('::1')).toBe(6);
    expect(detectVersion('nope')).toBeNull();
  });

  it('isValid helpers', () => {
    expect(isValidIpv4('10.0.0.1')).toBe(true);
    expect(isValidIpv4('10.0.0')).toBe(false);
    expect(isValidIpv6('::1')).toBe(true);
    expect(isValidIpv6(':::1')).toBe(false);
  });
});

describe('parseCidr', () => {
  it('computes IPv4 /24 details', () => {
    const c = parseCidr('192.168.1.10/24');
    expect(c.network).toBe('192.168.1.0');
    expect(c.broadcast).toBe('192.168.1.255');
    expect(c.firstHost).toBe('192.168.1.1');
    expect(c.lastHost).toBe('192.168.1.254');
    expect(c.netmask).toBe('255.255.255.0');
    expect(c.wildcard).toBe('0.0.0.255');
    expect(c.totalAddresses).toBe(256n);
    expect(c.usableHosts).toBe(254n);
    expect(c.cidr).toBe('192.168.1.0/24');
  });

  it('handles IPv4 /32 host route', () => {
    const c = parseCidr('8.8.8.8/32');
    expect(c.network).toBe('8.8.8.8');
    expect(c.broadcast).toBe('8.8.8.8');
    expect(c.usableHosts).toBe(1n);
  });

  it('handles IPv4 /31 point-to-point', () => {
    const c = parseCidr('10.0.0.0/31');
    expect(c.totalAddresses).toBe(2n);
    expect(c.usableHosts).toBe(2n);
    expect(c.firstHost).toBe('10.0.0.0');
    expect(c.lastHost).toBe('10.0.0.1');
  });

  it('defaults bare IP to host prefix', () => {
    expect(parseCidr('1.2.3.4').prefix).toBe(32);
    expect(parseCidr('2001:db8::1').prefix).toBe(128);
  });

  it('rejects bad prefix', () => {
    expect(() => parseCidr('1.2.3.4/33')).toThrow();
    expect(() => parseCidr('::1/129')).toThrow();
  });

  it('computes IPv6 /64', () => {
    const c = parseCidr('2001:db8::1/64');
    expect(c.network).toBe('2001:db8::');
    expect(c.prefix).toBe(64);
    expect(c.totalAddresses).toBe(1n << 64n);
  });
});

describe('ipInCidr / sameSubnet / distance', () => {
  it('membership true/false', () => {
    expect(ipInCidr('10.0.5.1', '10.0.0.0/16')).toBe(true);
    expect(ipInCidr('11.0.0.1', '10.0.0.0/16')).toBe(false);
  });

  it('rejects mixed versions', () => {
    expect(() => ipInCidr('1.2.3.4', '2001:db8::/32')).toThrow();
  });

  it('sameSubnet', () => {
    expect(sameSubnet('192.168.1.1', '192.168.1.200', 24)).toBe(true);
    expect(sameSubnet('192.168.1.1', '192.168.2.1', 24)).toBe(false);
  });

  it('distance', () => {
    expect(distance('10.0.0.1', '10.0.0.5')).toBe(4n);
    expect(distance('10.0.0.5', '10.0.0.1')).toBe(4n);
  });
});

describe('classifyAddress', () => {
  it('classifies private IPv4', () => {
    const c = classifyAddress('10.1.2.3');
    expect(c.kinds).toContain('private');
    expect(c.classful).toBe('A');
  });

  it('classifies loopback and link-local', () => {
    expect(classifyAddress('127.0.0.1').kinds).toContain('loopback');
    expect(classifyAddress('169.254.1.1').kinds).toContain('link-local');
  });

  it('classifies CGNAT and documentation', () => {
    expect(classifyAddress('100.64.0.1').kinds).toContain('cgnat');
    expect(classifyAddress('192.0.2.1').kinds).toContain('documentation');
  });

  it('classifies multicast and reserved', () => {
    expect(classifyAddress('224.0.0.1').kinds).toContain('multicast');
    expect(classifyAddress('240.0.0.1').kinds).toContain('reserved');
    expect(classifyAddress('240.0.0.1').classful).toBe('E');
  });

  it('classifies IPv6 kinds', () => {
    expect(classifyAddress('::1').kinds).toContain('loopback');
    expect(classifyAddress('fe80::1').kinds).toContain('link-local');
    expect(classifyAddress('fd00::1').kinds).toContain('unique-local');
    expect(classifyAddress('ff02::1').kinds).toContain('multicast');
    expect(classifyAddress('2001:db8::1').kinds).toContain('documentation');
    expect(classifyAddress('::ffff:1.2.3.4').kinds).toContain('ipv4-mapped');
  });

  it('classifies global public', () => {
    expect(classifyAddress('8.8.8.8').kinds).toContain('global');
  });
});

describe('mask conversion', () => {
  it('prefix to netmask and wildcard', () => {
    expect(prefixToNetmask(4, 24)).toBe('255.255.255.0');
    expect(prefixToWildcard(24)).toBe('0.0.0.255');
    expect(prefixToNetmask(4, 0)).toBe('0.0.0.0');
    expect(prefixToNetmask(4, 32)).toBe('255.255.255.255');
  });

  it('netmask to prefix', () => {
    expect(netmaskToPrefix('255.255.255.0')).toBe(24);
    expect(netmaskToPrefix('255.255.255.252')).toBe(30);
  });

  it('rejects non-contiguous mask', () => {
    expect(() => netmaskToPrefix('255.0.255.0')).toThrow();
  });
});

describe('IPv4 ↔ special IPv6 forms', () => {
  it('maps and unmaps IPv4', () => {
    const m = ipv4ToMapped('192.0.2.10');
    expect(m).toMatch(/^::ffff:/);
    expect(mappedToIpv4(m)).toBe('192.0.2.10');
  });

  it('rejects non-mapped for unmap', () => {
    expect(() => mappedToIpv4('2001:db8::1')).toThrow();
  });

  it('encodes and decodes 6to4', () => {
    const a = encode6to4('192.0.2.10');
    expect(a.startsWith('2002:')).toBe(true);
    const d = decode6to4(a);
    expect(d.ipv4).toBe('192.0.2.10');
  });

  it('decodes Teredo layout', () => {
    // Build: 2001:0000 | 65.54.227.120 | flags 0x8000 | port 0x63bf^ffff | client 192.0.2.45 obfuscated
    // Use a known-style constructed address via encode path components
    const server = parseIp('65.54.227.120').value;
    const flags = 0x8000n;
    const port = 40000;
    const portObf = BigInt(port ^ 0xffff);
    const client = parseIp('192.0.2.45').value;
    const clientObf = client ^ ((1n << 32n) - 1n);
    const value =
      (0x20010000n << 96n) |
      (server << 64n) |
      (flags << 48n) |
      (portObf << 32n) |
      clientObf;
    // format via parse roundtrip of expanded hex groups
    const expanded = value.toString(16).padStart(32, '0');
    const groups = expanded.match(/.{1,4}/g)!.join(':');
    const d = decodeTeredo(groups);
    expect(d.serverIpv4).toBe('65.54.227.120');
    expect(d.clientIpv4).toBe('192.0.2.45');
    expect(d.udpPort).toBe(port);
    expect(d.flags).toBe(0x8000);
  });
});

describe('expand / split / summarize / range', () => {
  it('expands small CIDR fully', () => {
    const r = expandCidr('10.0.0.0/30');
    expect(r.addresses).toEqual(['10.0.0.0', '10.0.0.1', '10.0.0.2', '10.0.0.3']);
    expect(r.truncated).toBe(false);
  });

  it('truncates large expand', () => {
    const r = expandCidr('10.0.0.0/16');
    expect(r.truncated).toBe(true);
    expect(r.addresses.length).toBe(256);
    expect(r.total).toBe(65536n);
  });

  it('splits /24 into /26', () => {
    const r = splitCidr('192.168.0.0/24', 26);
    expect(r.subnets).toEqual([
      '192.168.0.0/26',
      '192.168.0.64/26',
      '192.168.0.128/26',
      '192.168.0.192/26',
    ]);
  });

  it('rejects split to larger network', () => {
    expect(() => splitCidr('10.0.0.0/24', 16)).toThrow();
  });

  it('summarizes adjacent /25s', () => {
    const r = summarizeCidrs(['192.168.0.0/25', '192.168.0.128/25']);
    expect(r).toEqual(['192.168.0.0/24']);
  });

  it('range to CIDR list', () => {
    const r = rangeToCidrList('10.0.0.1', '10.0.0.4');
    expect(r.length).toBeGreaterThan(0);
    // cover full range without gaps
    const starts = r.map((c) => parseCidr(c));
    expect(starts[0].networkValue).toBe(parseIp('10.0.0.1').value);
    expect(starts[starts.length - 1].broadcastValue).toBe(parseIp('10.0.0.4').value);
  });

  it('random in CIDR stays inside', () => {
    const cidr = '203.0.113.0/24';
    for (let i = 0; i < 20; i++) {
      const a = randomInCidr(cidr, () => 0.5);
      expect(ipInCidr(a, cidr)).toBe(true);
    }
  });
});

describe('macToLinkLocal', () => {
  it('builds fe80 link-local from MAC', () => {
    const ll = macToLinkLocal('00:1a:2b:3c:4d:5e');
    expect(ll.startsWith('fe80::')).toBe(true);
    // U/L bit flipped: 00 -> 02
    expect(ll).toContain('21a:2bff:fe3c:4d5e');
  });

  it('parses cisco dotted MAC', () => {
    expect(parseMac('001a.2b3c.4d5e')).toEqual([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]);
  });

  it('rejects bad MAC', () => {
    expect(() => parseMac('zz:zz:zz:zz:zz:zz')).toThrow();
  });
});

describe('batchProcess', () => {
  it('validates mixed lines and optional CIDR check', () => {
    const rows = batchProcess('10.0.0.1\nbad\n2001:db8::1\n# comment\n', {
      checkCidr: '10.0.0.0/8',
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].ok).toBe(true);
    expect(rows[0].inCidr).toBe(true);
    expect(rows[1].ok).toBe(false);
    expect(rows[2].ok).toBe(true);
    expect(rows[2].version).toBe(6);
  });
});
