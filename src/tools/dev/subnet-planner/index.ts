import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'subnet-planner',
  name: 'Subnet Planner',
  shortDescription: 'Expand, split, summarize CIDRs and convert IP ranges offline.',
  description:
    'Plan IPv4 and IPv6 networks offline. Expand a CIDR into host lists with a safe cap, split a prefix into smaller subnets, summarize contiguous blocks, collapse a start–end range into CIDRs, or pick a random address inside a prefix. Nothing leaves your browser.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'subnet split',
    'cidr expand',
    'summarize routes',
    'range to cidr',
    'random ip',
    'subnetting',
    'prefix aggregation',
    'vlsm',
  ],
  tags: [
    'subnet calculator',
    'network planner',
    'cidr splitter',
    'ip range to cidr',
    'route summarization',
    'host list generator',
    'vlsm calculator',
  ],
  icon: '📐',
  component: () => import('./SubnetPlanner.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'active',
  seo: {
    title: 'Subnet Planner — Split & Summarize Offline',
    description:
      'Free offline subnet planner. Expand hosts, split CIDRs, summarize prefixes, convert ranges, and pick random IPs for IPv4 and IPv6.',
    keywords: ['subnet planner', 'cidr split', 'range to cidr', 'subnet calculator'],
  },
};

export default tool;
