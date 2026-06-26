import { describe, it, expect } from 'vitest';
import {
  parsePcap,
  parsePcapFile,
  parseLayers,
  buildStats,
  buildConversations,
  buildTopology,
  formatBytes,
  formatDuration,
} from '../../src/tools/dev/pcap-analyzer/pcap';

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function buildPcap(frames: Uint8Array[]): Uint8Array {
  const out: number[] = [];
  const pushU32 = (v: number) => out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const pushU16 = (v: number) => out.push((v >>> 8) & 255, v & 255);
  pushU32(0xa1b2c3d4); pushU16(2); pushU16(4); pushU32(0); pushU32(0); pushU32(65535); pushU32(1);
  let sec = 1;
  for (const f of frames) {
    pushU32(sec++); pushU32(0); pushU32(f.length); pushU32(f.length);
    for (const b of f) out.push(b);
  }
  return new Uint8Array(out);
}

const SYN = hexToBytes(
  'aabbccddeeff 112233445566 0800' +
  '4500003c0001400040060000 0a000001 0a000002' +
  '01bb13880000000100000000500220000000 0000',
);
const ARP = hexToBytes(
  'ffffffffffff 112233445566 0806' +
  '0001080006040001 112233445566 0a000001 000000000000 0a000002',
);
const UDP_DNS = hexToBytes(
  'aabbccddeeff 112233445566 0800' +
  '4500001e0000400040110000 0a000001 0a000002' +
  '0035003500000000',
);

describe('pcap-analyzer parseLayers', () => {
  it('decodes an Ethernet/IPv4/TCP frame', () => {
    const layers = parseLayers(1, SYN);
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'IPv4', 'TCP']);
  });

  it('decodes an ARP request', () => {
    const layers = parseLayers(1, ARP);
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'ARP']);
    expect(layers[1].summary).toContain('who-has');
  });

  it('decodes a UDP frame', () => {
    const layers = parseLayers(1, UDP_DNS);
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'IPv4', 'UDP']);
  });

  it('handles raw IP link type (101)', () => {
    const raw = hexToBytes('4500003c0001400040060000 0a000001 0a000002 01bb13880000000100000000500220000000');
    const layers = parseLayers(101, raw);
    expect(layers[0].name).toBe('IPv4');
  });

  it('handles a short frame as Raw', () => {
    const layers = parseLayers(1, hexToBytes('0011'));
    expect(layers[0].name).toBe('Raw');
  });

  it('decodes 802.1Q VLAN', () => {
    const vlan = hexToBytes(
      'aabbccddeeff 112233445566 8100 0064 0800' +
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000',
    );
    const layers = parseLayers(1, vlan);
    expect(layers[0].name).toBe('Ethernet');
    expect(layers[layers.length - 1].name).toBe('UDP');
  });

  it('decodes a single MPLS label with an inner IPv4 frame', () => {
    const mpls = hexToBytes(
      'aabbccddeeff 112233445566 8847' +
      '00010140' + // label=16, tc=0, s=1, ttl=64
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000',
    );
    const layers = parseLayers(1, mpls);
    const names = layers.map((l) => l.name);
    expect(names).toEqual(['Ethernet', 'MPLS', 'IPv4', 'UDP']);
    expect(layers[1].fields.label).toBe('16');
    expect(layers[1].fields.s).toBe('1');
  });

  it('decodes stacked 802.1Q QinQ tags with distinct keys', () => {
    const qinq = hexToBytes(
      'aabbccddeeff 112233445566 8100 0064 8100 0065 0800' +
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000',
    );
    const layers = parseLayers(1, qinq);
    const eth = layers[0];
    expect(eth.fields.vlan).toBe('100');
    expect(eth.fields.vlan2).toBe('101');
  });

  it('decodes IPv6 ICMPv6 (proto 58) as an ICMPv6 layer', () => {
    const icmp6 = hexToBytes(
      'aabbccddeeff 112233445566 86dd' +
      '6000000000083a40' +
      'fe800000000000000000000000000001 ff020000000000000000000000000001' +
      '8000 1234 0000 0000',
    );
    const layers = parseLayers(1, icmp6);
    const names = layers.map((l) => l.name);
    expect(names).toContain('ICMPv6');
  });

  it('decodes a stacked MPLS label with an inner IPv6 frame', () => {
    const mpls = hexToBytes(
      'aabbccddeeff 112233445566 8847' +
      '00010040 00011540' + // label=16 s=0, label=17 s=1
      '6000000000003b40 fe800000000000000000000000000001 fe8000000000000000000000000000002',
    );
    const layers = parseLayers(1, mpls);
    const names = layers.map((l) => l.name);
    expect(names).toEqual(['Ethernet', 'MPLS', 'IPv6']);
    expect(layers[1].summary).toBe('16, 17');
  });

  it('decodes a plain GRE header carrying IPv4', () => {
    const gre = hexToBytes(
      'aabbccddeeff 112233445566 0800' +
      '4500002600004000402f0000 0a000001 0a000002' +
      '00000800' + // GRE flags=0, proto=0x0800
      '4500001e0000400040110000 0c000001 0c000002 0035003500000000',
    );
    const layers = parseLayers(1, gre);
    const names = layers.map((l) => l.name);
    expect(names).toContain('GRE');
    expect(names.filter((n) => n === 'IPv4')).toHaveLength(2);
  });

  it('decodes GRE with key + sequence carrying MPLS', () => {
    const gre = hexToBytes(
      'aabbccddeeff 112233445566 0800' +
      '4500002c00004000402f0000 0a000001 0a000002' +
      '20008847' + // GRE flags=0x2000 (key), proto=0x8847 (MPLS)
      '0000abcd' + // key
      '00010140' + // MPLS label=16, s=1, ttl=64
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000',
    );
    const layers = parseLayers(1, gre);
    const names = layers.map((l) => l.name);
    expect(names).toContain('GRE');
    expect(names).toContain('MPLS');
    expect(names).toContain('IPv4');
    const greLayer = layers.find((l) => l.name === 'GRE')!;
    expect(greLayer.fields.key).toBeDefined();
  });

  it('decodes VXLAN with an inner Ethernet frame', () => {
    const inner = SYN;
    const udp = hexToBytes(
      'aabbccddeeff 112233445566 0800' +
      '4500003a0000400040110000 0a000001 0a000002' +
      'c00012b50026 0000' + // UDP sport=49152 dport=4789 len=38
      '0800000000001234', // VXLAN flags=0x08 vni=0x1234
    );
    // Replace inner payload with the SYN frame.
    const full = new Uint8Array(udp.length + inner.length);
    full.set(udp, 0);
    full.set(inner, udp.length);
    const layers = parseLayers(1, full);
    const names = layers.map((l) => l.name);
    expect(names).toContain('UDP');
    expect(names).toContain('VXLAN');
    expect(names.filter((n) => n === 'Ethernet')).toHaveLength(2);
  });
});

describe('pcap-analyzer parsePcap', () => {
  it('parses a valid pcap with two packets', () => {
    const pcap = buildPcap([SYN, ARP]);
    const r = parsePcap('test.pcap', pcap);
    expect(r.error).toBeUndefined();
    expect(r.packetCount).toBe(2);
    expect(r.format).toBe('pcap');
    expect(r.packets[0].protocols).toContain('TCP');
    expect(r.packets[1].protocols).toContain('ARP');
  });

  it('rejects a bad magic', () => {
    const r = parsePcap('bad', hexToBytes('0011223344556677889900aabbccddee 0011223344556677'));
    expect(r.error).toContain('bad magic');
  });

  it('parses little-endian pcap', () => {
    const frames = [SYN];
    const out: number[] = [];
    const p32 = (v: number) => out.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
    const p16 = (v: number) => out.push(v & 255, (v >>> 8) & 255);
    // Byte-swapped magic on disk (d4 c3 b2 a1) => little-endian pcap.
    out.push(0xd4, 0xc3, 0xb2, 0xa1);
    p16(2); p16(4); p32(0); p32(0); p32(65535); p32(1);
    p32(1); p32(0); p32(frames[0].length); p32(frames[0].length);
    for (const b of frames[0]) out.push(b);
    const r = parsePcap('le.pcap', new Uint8Array(out));
    expect(r.packetCount).toBe(1);
    expect(r.packets[0].protocols).toContain('TCP');
  });

  it('parsePcapFile dispatches by magic (pcap vs pcapng)', () => {
    const pcap = buildPcap([SYN]);
    const r = parsePcapFile('x.pcap', pcap);
    expect(r.format).toBe('pcap');
    // pcapng magic
    const ng = new Uint8Array(28);
    new Uint8Array(ng.buffer).set(hexToBytes('0a0d0d0a'), 0);
    const rng = parsePcapFile('x.pcapng', ng);
    expect(rng.format).toBe('pcapng');
  });
});

describe('pcap-analyzer stats/topology', () => {
  const packets = parsePcap('t', buildPcap([SYN, ARP, UDP_DNS])).packets;

  it('builds stats with protocol counts', () => {
    const s = buildStats(packets);
    expect(s.packetCount).toBe(3);
    expect(s.byProto['TCP'] ?? 0).toBe(1);
    expect(s.byProto['ARP'] ?? 0).toBe(1);
    expect(s.byProto['UDP'] ?? 0).toBe(1);
    expect(s.totalBytes).toBeGreaterThan(0);
  });

  it('builds conversations grouped by endpoint pair', () => {
    const convs = buildConversations(packets);
    // SYN and UDP share src/dst 10.0.0.1->10.0.0.2 but differ in L4 proto.
    expect(convs.length).toBeGreaterThanOrEqual(2);
    const tcpConv = convs.find((c) => c.proto === 'TCP');
    expect(tcpConv?.src).toBe('10.0.0.1');
    expect(tcpConv?.dst).toBe('10.0.0.2');
    expect(tcpConv?.packets.length).toBe(1);
  });

  it('builds an undirected topology from conversations', () => {
    const convs = buildConversations(packets);
    const topo = buildTopology(convs);
    const ips = topo.nodes.map((n) => n.id);
    expect(ips).toContain('10.0.0.1');
    expect(ips).toContain('10.0.0.2');
    expect(topo.edges.length).toBeGreaterThanOrEqual(1);
  });

  it('formatBytes scales correctly', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('formatDuration scales correctly', () => {
    expect(formatDuration(1e6)).toBe('1.00 ms');
    expect(formatDuration(2e9)).toBe('2.00 s');
  });
});
