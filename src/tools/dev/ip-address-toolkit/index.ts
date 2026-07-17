import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'ip-address-toolkit',
  name: 'IP Address Toolkit',
  shortDescription: 'Inspect, calculate, and convert IPv4/IPv6 addresses and subnets offline.',
  description:
    'Work with IPv4 and IPv6 addresses entirely in your browser. Inspect an IP or CIDR, check membership in a subnet, split and summarize prefixes, convert masks, map IPv4 into IPv6 special forms, expand host lists with a safe cap, and batch-validate address lists. WHOIS, geolocation, and reverse DNS are linked out because they need the network. Nothing you type is uploaded.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'ip',
    'ipv4',
    'ipv6',
    'cidr',
    'subnet',
    'netmask',
    'wildcard',
    'prefix',
    'network calculator',
    'ip calculator',
    'address classification',
    'private ip',
    'link local',
    'eui-64',
    '6to4',
    'teredo',
  ],
  tags: [
    'cidr calculator',
    'subnet calculator',
    'wildcard mask',
    'ip range',
    'prefix length',
    'ip validator',
    'subnet splitter',
    'ip to binary',
    'host calculator',
    'address planner',
  ],
  icon: '🌐',
  component: () => import('./IpAddressToolkit.tsx'),
  heavy: false,
  featured: true,
  status: 'active',
  seo: {
    title: 'IP Address Toolkit — IPv4 & IPv6 Offline',
    description:
      'Free offline IP and CIDR calculator for IPv4 and IPv6. Subnet math, classification, conversions, and batch checks in your browser.',
    keywords: [
      'ip calculator',
      'cidr calculator',
      'subnet calculator',
      'ipv6 calculator',
      'ip address tool',
    ],
  },
};

export default tool;
