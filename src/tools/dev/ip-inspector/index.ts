import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'ip-inspector',
  name: 'IP Inspector',
  shortDescription: 'Inspect IPv4/IPv6 addresses and CIDR subnets offline.',
  description:
    'Paste an IPv4 or IPv6 address or a CIDR prefix and see the canonical form, expanded form, classification, network, broadcast, host range, netmask, wildcard, binary, hex, and usable host count. Everything runs in your browser so the address never leaves your device.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'ip lookup',
    'cidr details',
    'network address',
    'broadcast address',
    'host range',
    'ip binary',
    'ip hex',
    'address classification',
  ],
  tags: [
    'ip what is my network',
    'cidr decoder',
    'subnet details',
    'usable hosts calculator',
    'ip address analyzer',
    'prefix calculator',
  ],
  icon: '🔍',
  component: () => import('./IpInspector.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'active',
  seo: {
    title: 'IP Inspector — CIDR & Address Offline',
    description:
      'Free offline IP and CIDR inspector for IPv4 and IPv6. Network, hosts, mask, binary, and classification in your browser.',
    keywords: ['ip inspector', 'cidr calculator', 'ip address lookup offline', 'subnet details'],
  },
};

export default tool;
