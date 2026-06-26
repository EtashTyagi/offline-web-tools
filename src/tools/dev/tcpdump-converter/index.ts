import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'tcpdump-converter',
  name: 'Tcpdump to Scapy Converter',
  shortDescription: 'Convert tcpdump hex dumps to Scapy Python code, hex, or Python bytes literals.',
  description:
    'Paste output from tcpdump (or plain hex bytes) and convert each packet into Scapy Python code that rebuilds it layer by layer, a clean hex string, or a Python bytes literal. Layers like Ethernet, VLAN, IPv4, IPv6, TCP, UDP, ICMP, ARP, VXLAN, MPLS, and GRE are detected and reconstructed so bytes(pkt) matches the original. Everything runs offline in your browser.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'tcpdump', 'scapy', 'packet builder', 'hex dump', 'raw bytes', 'python',
    'packet converter', 'pcap to scapy', 'tcpdump to python', 'network packet',
    'mpls', 'gre', 'vxlan', 'vlan',
  ],
  tags: [
    'tcpdump to scapy', 'hex to scapy', 'packet to python', 'tcpdump to hex',
    'scapy packet generator', 'raw bytes python', 'hex dump decoder',
    'mpls scapy', 'gre scapy',
  ],
  icon: '📟',
  component: () => import('./TcpdumpConverter.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Tcpdump to Scapy Converter — Free & Offline',
    description:
      'Convert tcpdump hex dumps into Scapy Python code, hex, or Python bytes literals. Layer-by-layer reconstruction, 100% in your browser.',
    keywords: ['tcpdump to scapy', 'scapy converter', 'hex to scapy', 'tcpdump to python', 'packet builder'],
  },
};

export default tool;
