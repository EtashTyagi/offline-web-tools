import { describe, it, expect } from 'vitest';
import {
  parseTcpdump,
  parseHexInput,
  parseScapyString,
  parseScapyCode,
  parseRawBytesInput,
  detectFormat,
  parseLayers,
  bytesToHex,
  bytesToPythonLiteral,
  toScapy,
  toScapyString,
  toHexOutput,
  toRawBytesOutput,
  toTcpdump,
  splitPackets,
  hexToBytes,
} from '../../src/tools/dev/packet-format-converter/parse';

const TCP_SYN_HEX =
  'aa bb cc dd ee ff 11 22 33 44 55 66 08 00 ' +
  '45 00 00 3c 00 00 40 00 40 06 00 00 0a 00 00 01 0a 00 00 02 ' +
  '00 50 01 bb 00 00 00 00 00 00 00 00 50 02 20 00 00 00 00 00';

function htb(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('tcpdump input parsing', () => {
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
    const bytes = htb(TCP_SYN_HEX);
    const layers = parseLayers(bytes);
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'IPv4', 'TCP']);
  });

  it('extracts TCP ports and flags', () => {
    const layers = parseLayers(htb(TCP_SYN_HEX));
    const tcp = layers.find((l) => l.name === 'TCP')!;
    const f = Object.fromEntries(tcp.fields.map((x) => [x.key, x.value]));
    expect(f.sport).toBe('80');
    expect(f.dport).toBe('443');
    expect(f.flags).toBe('S');
  });

  it('parses raw IPv4 without an Ethernet header', () => {
    const raw = '45 00 00 14 00 00 40 00 40 06 00 00 0a 00 00 01 0a 00 00 02';
    const layers = parseLayers(htb(raw));
    expect(layers[0].name).toBe('IPv4');
  });

  it('parses an ARP request', () => {
    const arp =
      'ff ff ff ff ff ff 00 11 22 33 44 55 08 06 ' +
      '00 01 08 00 06 04 00 01 00 11 22 33 44 55 0a 00 00 01 ' +
      '00 00 00 00 00 00 0a 00 00 02';
    const layers = parseLayers(htb(arp));
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'ARP']);
    expect(layers[1].summary).toBe('request');
  });

  it('parses a single MPLS label with an inner IPv4 frame', () => {
    const mpls =
      'aabbccddeeff 112233445566 8847 ' +
      '00010140 ' +
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000';
    const layers = parseLayers(htb(mpls));
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'MPLS', 'IPv4', 'UDP']);
    const mplsLayer = layers.find((l) => l.name === 'MPLS')!;
    const f = Object.fromEntries(mplsLayer.fields.map((x) => [x.key, x.value]));
    expect(f.label).toBe('16');
    expect(f.s).toBe('1');
    expect(f.ttl).toBe('64');
  });

  it('parses a single ICMPv6 packet (proto 58)', () => {
    const icmp6 = htb(
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
      '00010040 ' +
      '00011140 ' +
      '6000000000083a40' +
      'fe800000000000000000000000000001 fe800000000000000000000000000002' +
      '8000 1234 0000 0000';
    const layers = parseLayers(htb(mpls));
    expect(layers.map((l) => l.name)).toEqual(['Ethernet', 'MPLS', 'IPv6', 'ICMP']);
    expect(layers[1].summary).toBe('16, 17');
  });

  it('parses MPLS after a VLAN tag', () => {
    const mpls =
      'aabbccddeeff 112233445566 8100 0064 8847 ' +
      '00010140 ' +
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000';
    const layers = parseLayers(htb(mpls));
    expect(layers.map((l) => l.name)).toContain('MPLS');
    expect(layers.map((l) => l.name)).toContain('IPv4');
  });

  it('parses a plain GRE header carrying IPv4', () => {
    const gre =
      'aabbccddeeff 112233445566 0800' +
      '4500002600004000402f0000 0a000001 0a000002' +
      '00000800' +
      '450000140000400040060000 0c000001 0c000002' +
      '005000500000000000000000500200000000';
    const layers = parseLayers(htb(gre));
    expect(layers.map((l) => l.name)).toContain('GRE');
    expect(layers.filter((l) => l.name === 'IPv4')).toHaveLength(2);
  });

  it('parses GRE with key + sequence options carrying MPLS', () => {
    const gre =
      'aabbccddeeff 112233445566 0800' +
      '4500002c00004000402f0000 0a000001 0a000002' +
      '20008847' +
      '0000abcd' +
      '00010140' +
      '4500001e0000400040110000 0a000001 0a000002 0035003500000000';
    const layers = parseLayers(htb(gre));
    expect(layers.map((l) => l.name)).toContain('GRE');
    expect(layers.map((l) => l.name)).toContain('MPLS');
    expect(layers.map((l) => l.name)).toContain('IPv4');
    const greLayer = layers.find((l) => l.name === 'GRE')!;
    const f = Object.fromEntries(greLayer.fields.map((x) => [x.key, x.value]));
    expect(f.key).toBeDefined();
  });

  it('parses VXLAN with an inner Ethernet/IP frame', () => {
    const inner = TCP_SYN_HEX.replace(/[^0-9a-fA-F ]/g, '');
    const udp = '00 00 12 b5 00 00 00 00';
    const vxlan = '08 00 00 00 00 00 12 34';
    const ethType = '08 00';
    const ethernet = 'aa bb cc dd ee ff 11 22 33 44 55 66';
    const payload = inner + ' extra';
    const full = ethernet + ' ' + ethType + ' ' + '45 00 00 1c 00 00 40 00 40 11 00 00 0a 00 00 01 0a 00 00 02 ' + udp + ' ' + vxlan + ' ' + ethernet + ' ' + ethType + ' ' + payload;
    const layers = parseLayers(htb(full));
    expect(layers.map((l) => l.name)).toContain('UDP');
    expect(layers.map((l) => l.name)).toContain('VXLAN');
    expect(layers.filter((l) => l.name === 'Ethernet')).toHaveLength(2);
  });
});

describe('hex input parsing', () => {
  it('parses continuous hex string', () => {
    const pkts = parseHexInput('aabbccddeeff');
    expect(pkts).toHaveLength(1);
    expect(pkts[0].bytes.length).toBe(6);
  });

  it('parses space-separated hex', () => {
    const pkts = parseHexInput('aa bb cc dd ee ff');
    expect(pkts).toHaveLength(1);
    expect(pkts[0].bytes.length).toBe(6);
  });

  it('returns empty for no hex', () => {
    expect(parseHexInput('')).toHaveLength(0);
    expect(parseHexInput('hello')).toHaveLength(0);
  });
});

describe('raw bytes input parsing', () => {
  it('parses a Python bytes literal', () => {
    const pkts = parseRawBytesInput("b'\\xaa\\xbb\\xcc\\xdd\\xee\\xff'");
    expect(pkts).toHaveLength(1);
    expect(pkts[0].bytes[0]).toBe(0xaa);
    expect(pkts[0].bytes[5]).toBe(0xff);
  });

  it('handles printable ASCII in bytes literal', () => {
    const pkts = parseRawBytesInput("b'ABC'");
    expect(pkts).toHaveLength(1);
    expect(pkts[0].bytes[0]).toBe(0x41);
    expect(pkts[0].bytes[1]).toBe(0x42);
    expect(pkts[0].bytes[2]).toBe(0x43);
  });

  it('parses multiple bytes literals', () => {
    const pkts = parseRawBytesInput("pkt0 = b'\\x01\\x02'\npkt1 = b'\\x03\\x04'");
    expect(pkts).toHaveLength(2);
  });

  it('handles escape sequences', () => {
    const pkts = parseRawBytesInput("b'\\n\\r\\t\\\\'");
    expect(pkts).toHaveLength(1);
    expect(pkts[0].bytes[0]).toBe(0x0a);
    expect(pkts[0].bytes[1]).toBe(0x0d);
    expect(pkts[0].bytes[2]).toBe(0x09);
    expect(pkts[0].bytes[3]).toBe(0x5c);
  });
});

describe('Scapy string input parsing', () => {
  it('parses a simple Ethernet/IP/TCP packet', () => {
    const input = "<Ether  dst=aa:bb:cc:dd:ee:ff src=11:22:33:44:55:66 type=IPv4 |<IP  version=4 ihl=5 tos=0x0 len=60 id=1 flags=010 frag=0 ttl=64 proto=tcp src=10.0.0.1 dst=10.0.0.2 |<TCP  sport=443 dport=5000 seq=1 ack=0 dataofs=5 flags=S window=8192 urgptr=0 |>>>";
    const pkts = parseScapyString(input);
    expect(pkts).toHaveLength(1);
    expect(pkts[0].bytes.length).toBeGreaterThan(0);
    const layerNames = pkts[0].layers.map((l) => l.name);
    expect(layerNames).toContain('Ethernet');
    expect(layerNames).toContain('IPv4');
    expect(layerNames).toContain('TCP');
  });

  it('parses a packet with Raw payload', () => {
    const input = "<Ether  dst=aa:bb:cc:dd:ee:ff src=11:22:33:44:55:66 type=IPv4 |<IP  version=4 ihl=5 tos=0x0 len=24 id=0 flags=000 frag=0 ttl=64 proto=tcp src=10.0.0.1 dst=10.0.0.2 |<Raw  load=b'\\xde\\xad\\xbe\\xef' |>>>";
    const pkts = parseScapyString(input);
    expect(pkts).toHaveLength(1);
    const hex = bytesToHex(pkts[0].bytes);
    expect(hex).toContain('deadbeef');
  });
});

describe('Scapy code input parsing', () => {
  it('parses Ether/IP/TCP code', () => {
    const input = "pkt0 = Ether(dst='aa:bb:cc:dd:ee:ff', src='11:22:33:44:55:66', type=0x0800) / IP(version=4, ihl=5, tos=0, len=60, id=1, flags=2, frag=0, ttl=64, proto=6, src='10.0.0.1', dst='10.0.0.2') / TCP(sport=443, dport=5000, seq=1, ack=0, dataofs=5, flags='S', window=8192, urgptr=0)";
    const pkts = parseScapyCode(input);
    expect(pkts).toHaveLength(1);
    const layerNames = pkts[0].layers.map((l) => l.name);
    expect(layerNames).toContain('Ethernet');
    expect(layerNames).toContain('IPv4');
    expect(layerNames).toContain('TCP');
  });

  it('parses code with import lines', () => {
    const input = [
      'from scapy.all import *',
      '',
      "pkt0 = Ether(dst='aa:bb:cc:dd:ee:ff', src='11:22:33:44:55:66', type=0x0800) / IP(version=4, ihl=5, tos=0, len=20, id=0, flags=0, frag=0, ttl=64, proto=6, src='10.0.0.1', dst='10.0.0.2')",
    ].join('\n');
    const pkts = parseScapyCode(input);
    expect(pkts).toHaveLength(1);
  });

  it('parses multiple packets', () => {
    const input = [
      "pkt0 = Ether(dst='aa:bb:cc:dd:ee:ff', src='11:22:33:44:55:66', type=0x0800) / IP(version=4, ihl=5, tos=0, len=20, id=0, flags=0, frag=0, ttl=64, proto=6, src='10.0.0.1', dst='10.0.0.2')",
      "pkt1 = Ether(dst='ff:ff:ff:ff:ff:ff', src='00:11:22:33:44:55', type=0x0806) / ARP(op=1, hwsrc='00:11:22:33:44:55', psrc='10.0.0.1', hwdst='00:00:00:00:00:00', pdst='10.0.0.2')",
    ].join('\n');
    const pkts = parseScapyCode(input);
    expect(pkts).toHaveLength(2);
  });
});

describe('auto-detect format', () => {
  it('detects tcpdump format', () => {
    const input = '0x0000:  aabb ccdd eeff 1122 3344 5566 0800 4500  ........"3Uf..E.';
    expect(detectFormat(input)).toBe('tcpdump');
  });

  it('detects scapy string format', () => {
    const input = '<Ether  dst=aa:bb:cc:dd:ee:ff src=11:22:33:44:55:66 type=IPv4 |>';
    expect(detectFormat(input)).toBe('scapy-string');
  });

  it('detects scapy code format', () => {
    const input = "Ether(dst='aa:bb:cc:dd:ee:ff') / IP(src='10.0.0.1')";
    expect(detectFormat(input)).toBe('scapy-code');
  });

  it('detects raw bytes format', () => {
    const input = "b'\\xaa\\xbb\\xcc\\xdd\\xee\\xff'";
    expect(detectFormat(input)).toBe('raw-bytes');
  });

  it('detects hex format', () => {
    expect(detectFormat('aabbccddeeff')).toBe('hex');
    expect(detectFormat('aa bb cc dd ee ff')).toBe('hex');
  });

  it('detects tcpdump with summary lines', () => {
    const input = [
      '12:00:00.000123 IP 10.0.0.1.443 > 10.0.0.2.5000: Flags [S],',
      '  0x0000:  aabb ccdd eeff 1122 3344 5566 0800 4500',
    ].join('\n');
    expect(detectFormat(input)).toBe('tcpdump');
  });
});

describe('output generators', () => {
  it('bytesToHex round-trips', () => {
    const b = htb('de ad be ef');
    expect(bytesToHex(b)).toBe('deadbeef');
    expect(bytesToHex(b, ' ')).toBe('de ad be ef');
  });

  it('bytesToPythonLiteral keeps printable ASCII as characters', () => {
    const b = htb('41 42 0a 27 5c 00');
    expect(bytesToPythonLiteral(b)).toBe("b'AB\\n\\'\\\\\\x00'");
  });

  it('toScapy rebuilds a Scapy chain for TCP SYN', () => {
    const pkt = parseTcpdump(TCP_SYN_HEX)[0];
    const code = toScapy([pkt]);
    expect(code).toContain('from scapy.all import');
    expect(code).toContain("Ether(dst='aa:bb:cc:dd:ee:ff'");
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
    const input = '0x0000: 0011 2233\n\n0x0010: 4455 6677';
    const pkts = parseTcpdump(input);
    const code = toScapy(pkts);
    expect(code).toContain('packets = [pkt0, pkt1]');
  });

  it('returns a comment when there are no packets', () => {
    expect(toScapy([])).toContain('No packets');
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
    expect(code).toContain('MPLS(label=16, tc=0, s=0, ttl=64) / MPLS(label=17, tc=0, s=1, ttl=64)');
    expect(code).toContain('IP(version=4');
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
});

describe('Scapy string output', () => {
  it('generates Scapy string for TCP SYN', () => {
    const pkt = parseTcpdump(TCP_SYN_HEX)[0];
    const str = toScapyString([pkt]);
    expect(str).toContain('<Ether');
    expect(str).toContain('dst=aa:bb:cc:dd:ee:ff');
    expect(str).toContain('<IP');
    expect(str).toContain('src=10.0.0.1');
    expect(str).toContain('<TCP');
    expect(str).toContain('sport=80');
    expect(str).toContain('dport=443');
  });

  it('returns comment for empty packets', () => {
    expect(toScapyString([])).toContain('No packets');
  });

  it('handles multiple packets', () => {
    const input = '0x0000: 0011 2233\n\n0x0010: 4455 6677';
    const pkts = parseTcpdump(input);
    const str = toScapyString(pkts);
    expect(str).toContain('# packet 0');
    expect(str).toContain('# packet 1');
  });
});

describe('tcpdump output', () => {
  it('generates tcpdump hex dump', () => {
    const pkt = parseTcpdump(TCP_SYN_HEX)[0];
    const dump = toTcpdump([pkt]);
    expect(dump).toContain('0x0000:');
    expect(dump).toContain('aabb');
    expect(dump).toContain('10.0.0.1');
  });

  it('returns comment for empty packets', () => {
    expect(toTcpdump([])).toContain('No packets');
  });

  it('handles multiple packets', () => {
    const input = '0x0000: 0011 2233\n\n0x0010: 4455 6677';
    const pkts = parseTcpdump(input);
    const dump = toTcpdump(pkts);
    expect(dump).toContain('# packet 0');
    expect(dump).toContain('# packet 1');
  });
});

describe('hex output', () => {
  it('generates hex per packet', () => {
    const pkt = parseTcpdump(TCP_SYN_HEX)[0];
    const hex = toHexOutput([pkt]);
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });

  it('handles multiple packets', () => {
    const input = '0x0000: 0011 2233\n\n0x0010: 4455 6677';
    const pkts = parseTcpdump(input);
    const hex = toHexOutput(pkts);
    expect(hex).toContain('# packet 0');
    expect(hex).toContain('# packet 1');
  });
});

describe('raw bytes output', () => {
  it('generates Python bytes literal', () => {
    const pkt = parseTcpdump(TCP_SYN_HEX)[0];
    const raw = toRawBytesOutput([pkt]);
    expect(raw).toMatch(/^pkt0 = b'/);
  });
});

describe('round-trip conversions', () => {
  it('tcpdump → scapy code → tcpdump preserves bytes', () => {
    const pkts1 = parseTcpdump(TCP_SYN_HEX);
    const code = toScapy(pkts1);
    const pkts2 = parseScapyCode(code);
    expect(pkts2).toHaveLength(1);
    expect(bytesToHex(pkts2[0].bytes)).toBe(bytesToHex(pkts1[0].bytes));
  });

  it('tcpdump → scapy string → tcpdump preserves bytes', () => {
    const pkts1 = parseTcpdump(TCP_SYN_HEX);
    const str = toScapyString(pkts1);
    const pkts2 = parseScapyString(str);
    expect(pkts2).toHaveLength(1);
    expect(bytesToHex(pkts2[0].bytes)).toBe(bytesToHex(pkts1[0].bytes));
  });

  it('tcpdump → hex → tcpdump preserves bytes', () => {
    const pkts1 = parseTcpdump(TCP_SYN_HEX);
    const hex = toHexOutput(pkts1);
    const pkts2 = parseHexInput(hex);
    expect(pkts2).toHaveLength(1);
    expect(bytesToHex(pkts2[0].bytes)).toBe(bytesToHex(pkts1[0].bytes));
  });

  it('tcpdump → raw bytes → tcpdump preserves bytes', () => {
    const pkts1 = parseTcpdump(TCP_SYN_HEX);
    const raw = toRawBytesOutput(pkts1);
    const pkts2 = parseRawBytesInput(raw);
    expect(pkts2).toHaveLength(1);
    expect(bytesToHex(pkts2[0].bytes)).toBe(bytesToHex(pkts1[0].bytes));
  });
});
