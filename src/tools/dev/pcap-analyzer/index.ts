import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'pcap-analyzer',
  name: 'PCAP Analyzer',
  shortDescription: 'Inspect pcap/pcapng files: layers, statistics, topology, and packet flows, fully offline.',
  description:
    'Load one or more pcap or pcapng files and inspect them entirely in your browser. Each packet is decoded layer by layer (Ethernet, VLAN, IPv4, IPv6, TCP, UDP, ICMP, ARP, VXLAN, MPLS, GRE), with statistics, a network topology graph, conversation lists, and per-conversation packet flow tracing. Filtering and extra field details only appear when you ask for them. Nothing is uploaded.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'pcap', 'pcapng', 'packet analyzer', 'network capture', 'wireshark',
    'packet inspection', 'topology', 'tcpdump', 'packet flow', 'layer decoder',
    'network analysis', 'capture file', 'mpls', 'gre', 'vxlan', 'vlan',
  ],
  tags: [
    'pcap viewer', 'pcapng analyzer', 'packet decoder', 'network capture analyzer',
    'packet layer parser', 'pcap topology', 'offline packet inspector',
    'pcap statistics', 'mpls analyzer', 'gre decoder',
  ],
  icon: '🌐',
  component: () => import('./PcapAnalyzer.tsx'),
  heavy: true,
  featured: false,
  status: 'beta',
  seo: {
    title: 'PCAP Analyzer — Offline Packet & Topology Inspector',
    description:
      'Analyze pcap and pcapng files in your browser. Layer-by-layer decoding, statistics, network topology graph, conversations, and packet flow tracing. No uploads.',
    keywords: ['pcap analyzer', 'pcapng viewer', 'packet decoder', 'network topology', 'offline pcap'],
  },
};

export default tool;
