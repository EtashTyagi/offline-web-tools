import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'ip-special-ranges',
  name: 'IP Special Ranges',
  shortDescription: 'Browse offline reserved IP ranges and external lookup links.',
  description:
    'Browse common reserved and special-use IPv4 and IPv6 blocks offline, with RFC notes where they apply. For WHOIS, geolocation, reverse DNS, and BGP views that need the network, open the linked external services in a new tab. Your addresses are not sent by this tool.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'private ip ranges',
    'reserved ip',
    'rfc1918',
    'special use addresses',
    'link local range',
    'whois',
    'ip geolocation',
    'reverse dns',
  ],
  tags: [
    'private network ranges',
    'iana special use',
    'rfc 1918 list',
    'documentation prefixes',
    'cgnat range',
    'multicast ranges',
  ],
  icon: '🗂️',
  component: () => import('./IpSpecialRanges.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'active',
  seo: {
    title: 'IP Special Ranges & Lookup Links',
    description:
      'Offline list of reserved IPv4 and IPv6 ranges with RFC notes, plus external links for WHOIS, geo, DNS, and BGP. Free browser tool.',
    keywords: ['private ip ranges', 'rfc1918', 'special use ip', 'reserved ip addresses'],
  },
};

export default tool;
