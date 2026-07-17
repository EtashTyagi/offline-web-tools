// Lightweight metadata for every IP sub-tool. Kept free of IP-engine imports so
// the hub UI can list tools without pulling calculator code into its bundle.

export interface IpToolCard {
  id: string;
  name: string;
  icon: string;
  shortNote: string;
  badge: string;
  path: string;
}

export const IP_HUB_PATH = '/tools/dev/ip-address-toolkit';

export const IP_TOOLS: IpToolCard[] = [
  {
    id: 'ip-inspector',
    name: 'IP Inspector',
    icon: '🔍',
    shortNote: 'Parse IPv4/IPv6 or CIDR: network, hosts, mask, class, binary.',
    badge: 'Lookup',
    path: '/tools/dev/ip-inspector',
  },
  {
    id: 'ip-subnet-membership',
    name: 'Subnet Membership',
    icon: '📦',
    shortNote: 'Check if an IP sits in a CIDR, same-subnet tests, and distance.',
    badge: 'Contain',
    path: '/tools/dev/ip-subnet-membership',
  },
  {
    id: 'subnet-planner',
    name: 'Subnet Planner',
    icon: '📐',
    shortNote: 'Expand hosts, split prefixes, summarize, range→CIDR, random IP.',
    badge: 'Plan',
    path: '/tools/dev/subnet-planner',
  },
  {
    id: 'ip-converter',
    name: 'IP Converter',
    icon: '🔄',
    shortNote: 'Mapped IPv6, 6to4, Teredo, netmask↔prefix, MAC→link-local.',
    badge: 'Convert',
    path: '/tools/dev/ip-converter',
  },
  {
    id: 'ip-batch-validator',
    name: 'IP Batch Validator',
    icon: '📋',
    shortNote: 'Validate lists of addresses and optionally check a CIDR.',
    badge: 'Batch',
    path: '/tools/dev/ip-batch-validator',
  },
  {
    id: 'ip-special-ranges',
    name: 'IP Special Ranges',
    icon: '🗂️',
    shortNote: 'Offline reserved blocks plus external WHOIS, geo, DNS, BGP links.',
    badge: 'Reference',
    path: '/tools/dev/ip-special-ranges',
  },
];
