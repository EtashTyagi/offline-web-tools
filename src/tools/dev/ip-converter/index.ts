import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'ip-converter',
  name: 'IP Converter',
  shortDescription: 'Convert IPv4-mapped, 6to4, Teredo, masks, and MAC to link-local.',
  description:
    'Convert between special IPv4 and IPv6 forms offline. Map IPv4 into ::ffff, encode and decode 6to4 and Teredo, turn netmasks into prefix lengths and wildcards, or build an IPv6 link-local address from a MAC with modified EUI-64. Runs entirely in your browser.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'ipv4 mapped',
    '6to4',
    'teredo',
    'netmask',
    'wildcard mask',
    'eui-64',
    'link local',
    'mac to ipv6',
    'prefix length',
  ],
  tags: [
    'ipv4 to ipv6 converter',
    'ffff mapping',
    'eui64 calculator',
    'fe80 generator',
    'subnet mask converter',
    'wildcard mask calculator',
  ],
  icon: '🔄',
  component: () => import('./IpConverter.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'active',
  seo: {
    title: 'IP Converter — Mapped, 6to4, Mask Offline',
    description:
      'Free offline IP converter for IPv4-mapped IPv6, 6to4, Teredo, netmask↔prefix, and MAC to link-local. Runs in your browser.',
    keywords: ['ip converter', 'ipv4 mapped ipv6', '6to4 converter', 'mac to link local'],
  },
};

export default tool;
