import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'ip-batch-validator',
  name: 'IP Batch Validator',
  shortDescription: 'Validate lists of IPv4/IPv6 addresses and optional CIDR checks.',
  description:
    'Paste a list of IPv4 or IPv6 addresses, one per line, and validate them offline. See version, classification, and optional membership against a CIDR for every line. Handy for cleaning allowlists, inventory files, and config snippets. Nothing is uploaded.',
  category: 'dev',
  subcategory: 'networking',
  keywords: [
    'batch ip validate',
    'ip list checker',
    'bulk ip validation',
    'allowlist check',
    'ip inventory',
    'multi ip check',
  ],
  tags: [
    'bulk ip validator',
    'ip list parser',
    'validate ip addresses',
    'cidr allowlist check',
    'ip address scrubber',
    'mass ip check',
  ],
  icon: '📋',
  component: () => import('./IpBatchValidator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'active',
  seo: {
    title: 'IP Batch Validator — Free & Offline',
    description:
      'Validate lists of IPv4 and IPv6 addresses offline. Optional CIDR membership, classification, and clear per-line errors in your browser.',
    keywords: ['batch ip validator', 'bulk ip check', 'ip list validator', 'validate ip addresses'],
  },
};

export default tool;
