import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'packet-format-converter',
  name: 'Network Packet Format Converter',
  shortDescription: 'Convert network packets between Scapy, hex, raw bytes, and tcpdump formats.',
  description:
    'Paste network packet data in any of five formats and convert it to any other. Supports Scapy Python code, Scapy string representation, hex bytes, Python raw bytes literals, and tcpdump hex dumps. Layers like Ethernet, VLAN, IPv4, IPv6, TCP, UDP, ICMP, ARP, VXLAN, MPLS, and GRE are detected and reconstructed. Multiple packets and file upload are supported. Everything runs offline in your browser.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'packet converter', 'scapy', 'tcpdump', 'hex dump', 'raw bytes', 'python',
    'network packet', 'packet format', 'scapy to hex', 'hex to scapy',
    'tcpdump to scapy', 'scapy to tcpdump', 'packet builder',
    'pcap to scapy', 'network packet converter', 'mpls', 'gre', 'vxlan', 'vlan',
  ],
  tags: [
    'scapy converter', 'packet to python', 'tcpdump to hex',
    'scapy packet generator', 'raw bytes python', 'hex dump decoder',
    'network packet tool', 'packet format tool',
  ],
  icon: '📦',
  component: () => import('./PacketFormatConverter.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Network Packet Format Converter — Free & Offline',
    description:
      'Convert network packets between Scapy code, Scapy string, hex, raw bytes, and tcpdump formats. Layer reconstruction, 100% in your browser.',
    keywords: ['packet format converter', 'scapy converter', 'hex to scapy', 'tcpdump to scapy', 'network packet tool'],
  },
};

export default tool;
