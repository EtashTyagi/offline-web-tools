import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'ip-subnet-membership',
  name: 'Subnet Membership',
  shortDescription: 'Check if an IP is inside a CIDR and compare two addresses offline.',
  description:
    'Test whether an IPv4 or IPv6 address sits inside a CIDR subnet, or compare two addresses to see if they share a prefix and how far apart they are. Useful for ACL checks, route planning, and quick containment tests. Runs entirely in your browser.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'ip in subnet',
    'cidr membership',
    'same subnet',
    'ip distance',
    'containment check',
    'acl check',
    'prefix match',
  ],
  tags: [
    'ip belongs to network',
    'subnet containment',
    'address range check',
    'same network test',
    'cidr includes ip',
    'ip overlap check',
  ],
  icon: '📦',
  component: () => import('./IpSubnetMembership.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'active',
  seo: {
    title: 'Subnet Membership Checker — Offline',
    description:
      'Check if an IP is inside a CIDR, compare same-subnet membership, and measure address distance. Free offline tool for IPv4 and IPv6.',
    keywords: ['ip in subnet', 'cidr membership', 'same subnet check', 'ip distance'],
  },
};

export default tool;
