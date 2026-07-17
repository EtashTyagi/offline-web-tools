import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'ip-address-toolkit',
  name: 'IP Address Toolkit',
  shortDescription: 'Hub for offline IPv4/IPv6 inspect, subnet, plan, convert, and batch tools.',
  description:
    'A hub for free offline IP address tools. Open the inspector for full address and CIDR details, check subnet membership, plan splits and summaries, convert special IPv4/IPv6 forms, batch-validate lists, or browse reserved ranges. Every tool runs in your browser. Nothing is uploaded.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'ip toolkit',
    'ipv4',
    'ipv6',
    'cidr',
    'subnet',
    'ip calculator',
    'network tools',
    'ip address tools',
    'subnet tools',
  ],
  tags: [
    'network calculator suite',
    'offline ip tools',
    'cidr tools hub',
    'ipv6 utilities',
    'lan address tools',
  ],
  icon: '🌐',
  component: () => import('./IpAddressToolkit.tsx'),
  heavy: false,
  featured: true,
  status: 'active',
  seo: {
    title: 'IP Address Toolkit — Free Offline Tools',
    description:
      'Free offline hub for IPv4 and IPv6 tools. Inspect, check subnets, plan prefixes, convert, batch-validate, and browse special ranges in your browser.',
    keywords: [
      'ip address toolkit',
      'ip calculator',
      'cidr tools',
      'subnet tools',
      'ipv6 tools',
    ],
  },
};

export default tool;
