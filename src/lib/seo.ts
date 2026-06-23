import type { Tool } from '../types/tool';

const SITE_URL = import.meta.env.SITE_URL ?? 'https://offline-web-tools.com';

export function canonicalUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

export function toolUrl(tool: Tool): string {
  return `/tools/${tool.category}/${tool.id}`;
}

export interface MetaTags {
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogType: string;
  twitterCard: string;
}

export function buildMetaTags(opts: {
  title: string;
  description: string;
  keywords?: string[];
  path: string;
  ogType?: string;
}): MetaTags {
  const canonical = canonicalUrl(opts.path);
  return {
    title: opts.title,
    description: opts.description,
    keywords: (opts.keywords ?? []).join(', '),
    canonical,
    ogTitle: opts.title,
    ogDescription: opts.description,
    ogUrl: canonical,
    ogType: opts.ogType ?? 'website',
    twitterCard: 'summary_large_image',
  };
}

export function toolJsonLd(tool: Tool): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'Utility',
    operatingSystem: 'Any (Web Browser)',
    description: tool.description,
    url: canonicalUrl(toolUrl(tool)),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    keywords: tool.keywords.join(', '),
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'OfflineWebTools',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
