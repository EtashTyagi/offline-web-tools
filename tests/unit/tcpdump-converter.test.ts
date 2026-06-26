import { describe, it, expect } from 'vitest';
import {
  parseTcpdump,
  parseLayers,
  bytesToHex,
  bytesToPythonLiteral,
  toScapy,
  splitPackets,
} from '../../src/tools/dev/tcpdump-converter/parse';

// A minimal Ethernet/IPv4/TCP SYN packet (no payload).
const TCP_SYN_HEX =
  'aa bb cc dd ee ff 11 22 33 44 55 66 08 00 ' + // Ethernet: dst,src,type
  '45 00 00 3c 00 00 40 00 40 06 00 00 0a 00 00 01 0a 00 00 02 ' + // IPv4
  '00 50 01 bb 00 00 00 00 00 00 00 00 50 02 20 00 00 00 00 00'; // TCP

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('tcpdump-converter parse', () => {
  it('splits continuous plain hex into a single packet', () => {
    const blocks = splitPackets('aabbccddeeff 112233445566 0800');
    expect(blocks).toHaveLength(1);
  });

  it('splits multiple packets separated by summary lines', () => {
    const input = [
      '12:00:00.000001 IP 1.2.3.4.80 > 5.6.7.8.443: tcp',
      '  0x0000: 0011 2233',
      '12:00:00.000002 IP 9.9.9.9.1 > 8.8.8.8.2: tcp',
      '  0x0010: 4455 6677',
    ].join('\n');
    const blocks = splitPackets(input);
    expect(blocks).toHaveLength(2);
  });

  it('ignores the ASCII column in -X style dumps', () => {
    const input = '0x0000:  0011 2233   .."3';
    const pkt = parseTcpdump(input);
    expect(pkt).toHaveLength(1);
    expect(pkt[0].bytes[0]).toBe(0x00);
    expect(pkt[0].bytes[1]).toBe(0x11);
    expect(pkt[0].bytes[2]).toBe(0x22);
    expect(pkt[0].bytes[3]).toBe(0x33);
  });

  it('parses an Ethernet/IPv4/TCP SYN into three layers', () => {
    const bytes = hexToBytes(TCP_SYN_HEX);
    const layers = parseLayers(bytes);
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'IPv4', 'TCP']);
  });

  it('extracts TCP ports and flags', () => {
    const layers = parseLayers(hexToBytes(TCP_SYN_HEX));
    const tcp = layers.find((l) => l.name === 'TCP')!;
    const f = Object.fromEntries(tcp.fields.map((x) => [x.key, x.value]));
    expect(f.sport).toBe('80');
    expect(f.dport).toBe('443');
    expect(f.flags).toBe('S');
  });

  it('parses raw IPv4 without an Ethernet header', () => {
    const raw = '45 00 00 14 00 00 40 00 40 06 00 00 0a 00 00 01 0a 00 00 02';
    const layers = parseLayers(hexToBytes(raw));
    expect(layers[0].name).toBe('IPv4');
  });

  it('bytesToHex round-trips', () => {
    const b = hexToBytes('de ad be ef');
    expect(bytesToHex(b)).toBe('deadbeef');
    expect(bytesToHex(b, ' ')).toBe('de ad be ef');
  });

  it('bytesToPythonLiteral keeps printable ASCII as characters', () => {
    const b = hexToBytes('41 42 0a 27 5c 00');
    expect(bytesToPythonLiteral(b)).toBe("b'AB\\n\\'\\\\\\x00'");
  });

  it('toScapy rebuilds a Scapy chain for TCP SYN', () => {
    const pkt = parseTcpdump(TCP_SYN_HEX)[0];
    const code = toScapy([pkt]);
    expect(code).toContain('from scapy.all import');
    expect(code).toContain("Ether(dst='aa:bb:cc:dd:ee:ff'");
    expect(code).toContain("IP(version='4'".replace("'4'", '4'));
    expect(code).toContain("src='10.0.0.1'");
    expect(code).toContain("dst='10.0.0.2'");
    expect(code).toContain("TCP(sport=80, dport=443");
    expect(code).toContain("flags='S'");
  });

  it('toScapy attaches leftover payload as Raw', () => {
    const withPayload = TCP_SYN_HEX + ' dead beef';
    const pkt = parseTcpdump(withPayload)[0];
    const code = toScapy([pkt]);
    expect(code).toContain('Raw(load=b\'\\xde\\xad\\xbe\\xef\')');
  });

  it('toScapy handles multiple packets as a list', () => {
    const input =
      '0x0000: 0011 2233\n\n0x0010: 4455 6677';
    const pkts = parseTcpdump(input);
    const code = toScapy(pkts);
    expect(code).toContain('packets = [pkt0, pkt1]');
  });

  it('returns a comment when there are no packets', () => {
    expect(toScapy([])).toContain('No packets');
  });

  it('parses an ARP request', () => {
    const arp =
      'ff ff ff ff ff ff 00 11 22 33 44 55 08 06 ' +
      '00 01 08 00 06 04 00 01 00 11 22 33 44 55 0a 00 00 01 ' +
      '00 00 00 00 00 00 0a 00 00 02';
    const layers = parseLayers(hexToBytes(arp));
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'ARP']);
    const arpLayer = layers[1];
    expect(arpLayer.summary).toBe('request');
  });

  it('parses a single MPLS label with an inner IPv4 frame', () => {
    const mpls =
      'aabbccddeeff 112233445566 8847 ' +
      '00010140 ' + // label=16, tc=0, s=1, ttl=64
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000';
    const layers = parseLayers(hexToBytes(mpls));
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'MPLS', 'IPv4', 'UDP']);
    const mplsLayer = layers.find((l) => l.name === 'MPLS')!;
    const f = Object.fromEntries(mplsLayer.fields.map((x) => [x.key, x.value]));
    expect(f.label).toBe('16');
    expect(f.s).toBe('1');
    expect(f.ttl).toBe('64');
  });

  it('parses a single ICMPv6 packet (proto 58)', () => {
    const icmp6 = hexToBytes(
      'aabbccddeeff 112233445566 86dd' +
      '6000000000083a40' +
      'fe800000000000000000000000000001 ff020000000000000000000000000001' +
      '8000 1234 0000 0000',
    );
    const layers = parseLayers(icmp6);
    expect(layers.map((l) => l.name)).toContain('ICMP');
  });

  it('parses a stacked MPLS label with an inner IPv6 frame', () => {
    const mpls =
      'aabbccddeeff 112233445566 8847 ' +
      '00010040 ' + // label=16, tc=0, s=0, ttl=64
      '00011140 ' + // label=17, tc=0, s=1, ttl=64
      '6000000000083a40' +
      'fe800000000000000000000000000001 fe800000000000000000000000000002' +
      '8000 1234 0000 0000';
    const layers = parseLayers(hexToBytes(mpls));
    const names = layers.map((l) => l.name);
    expect(names).toEqual(['Ethernet', 'MPLS', 'IPv6', 'ICMP']);
    expect(layers[1].summary).toBe('16, 17');
  });

  it('toScapy rebuilds an MPLS label stack', () => {
    const mpls =
      'aabbccddeeff 112233445566 8847 ' +
      '00010040 00011140 ' +
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000';
    const pkt = parseTcpdump(mpls)[0];
    const code = toScapy([pkt]);
    expect(code).toContain('MPLS(label=16, tc=0, s=0, ttl=64)');
    expect(code).toContain('MPLS(label=17, tc=0, s=1, ttl=64)');
    // The two MPLS labels are chained with ` / ` between them.
    expect(code).toContain('MPLS(label=16, tc=0, s=0, ttl=64) / MPLS(label=17, tc=0, s=1, ttl=64)');
    expect(code).toContain('IP(version=4');
  });

  it('parses MPLS after a VLAN tag', () => {
    const mpls =
      'aabbccddeeff 112233445566 8100 0064 8847 ' +
      '00010140 ' +
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000';
    const layers = parseLayers(hexToBytes(mpls));
    const names = layers.map((l) => l.name);
    expect(names).toContain('MPLS');
    expect(names).toContain('IPv4');
  });

  it('parses a plain GRE header carrying IPv4', () => {
    const gre =
      'aabbccddeeff 112233445566 0800' +
      '4500002600004000402f0000 0a000001 0a000002' +
      '00000800' + // GRE flags=0, proto=0x0800 (IPv4)
      '450000140000400040060000 0c000001 0c000002' + // inner IPv4, proto=6 TCP
      '005000500000000000000000500200000000';
    const layers = parseLayers(hexToBytes(gre));
    const names = layers.map((l) => l.name);
    expect(names).toContain('GRE');
    expect(names).toContain('IPv4');
    expect(names.filter((n) => n === 'IPv4')).toHaveLength(2);
  });

  it('parses GRE with key + sequence options carrying MPLS', () => {
    const gre =
      'aabbccddeeff 112233445566 0800' +
      '4500002c00004000402f0000 0a000001 0a000002' +
      '20008847' + // GRE flags=0x2000 (key present), proto=0x8847 (MPLS)
      '0000abcd' + // key
      '00010140' + // MPLS label=16, s=1, ttl=64
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000';
    const layers = parseLayers(hexToBytes(gre));
    const names = layers.map((l) => l.name);
    expect(names).toContain('GRE');
    expect(names).toContain('MPLS');
    expect(names).toContain('IPv4');
    const greLayer = layers.find((l) => l.name === 'GRE')!;
    const f = Object.fromEntries(greLayer.fields.map((x) => [x.key, x.value]));
    expect(f.key).toBeDefined();
  });

  it('toScapy rebuilds a GRE layer', () => {
    const gre =
      'aabbccddeeff 112233445566 0800' +
      '4500002600004000402f0000 0a000001 0a000002' +
      '00000800' +
      '450000140000400040060000 0c000001 0c000002 005000500000000000000000500200000000';
    const pkt = parseTcpdump(gre)[0];
    const code = toScapy([pkt]);
    expect(code).toContain('GRE(proto=0x0800)');
  });

  it('parses VXLAN with an inner Ethernet/IP frame', () => {
    const inner = TCP_SYN_HEX.replace(/[^0-9a-fA-F ]/g, '');
    // UDP(4789) header (8 bytes) + VXLAN (8 bytes) + inner frame
    const udp = '00 00 12 b5 00 00 00 00';
    const vxlan = '08 00 00 00 00 00 12 34';
    const ethType = '08 00';
    const ethernet = 'aa bb cc dd ee ff 11 22 33 44 55 66';
    const payload = inner + ' extra';
    const full = ethernet + ' ' + ethType + ' ' + '45 00 00 1c 00 00 40 00 40 11 00 00 0a 00 00 01 0a 00 00 02 ' + udp + ' ' + vxlan + ' ' + ethernet + ' ' + ethType + ' ' + payload;
    const layers = parseLayers(hexToBytes(full));
    const names = layers.map((l) => l.name);
    expect(names).toContain('UDP');
    expect(names).toContain('VXLAN');
    expect(names.filter((n) => n === 'Ethernet')).toHaveLength(2);
  });
});
