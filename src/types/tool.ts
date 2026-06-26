export type ToolStatus = 'active' | 'beta' | 'experimental';

export interface ToolSeo {
  title: string;
  description: string;
  keywords: string[];
}

export interface Tool {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  subcategory?: string;
  keywords: string[];
  icon: string;
  component: () => Promise<any>;
  heavy?: boolean;
  featured?: boolean;
  status: ToolStatus;
  seo: ToolSeo;
  tags?: string[];
  hidden?: boolean; // when true, the tool page still builds (SEO/sitemap) but it
  // is excluded from the in-site search index and the flat category listings
  // so it does not clutter a parent grouping. Used for sub-tools reached from a
  // hub tool (e.g. per-country tax calculators under "Tax Calculators").
}

/**
 * `tags` are SEO synonyms: alternative search terms a user might type for this
 * tool (e.g. a mortgage calculator gets `['home loan', 'house loan',
 * 'home financing']`). Unlike `keywords`, tags are rendered as VISIBLE text on
 * the tool page ("Related terms" chips) so Google indexes them, and they feed
 * the in-site fuzzy search. Always populate tags with terms people actually
 * search for that are NOT already in the tool name.
 */

export interface Subcategory {
  slug: string;
  name: string;
}

export interface Category {
  slug: string;
  name: string;
  icon: string;
  description: string;
  subcategories?: Subcategory[];
}

export interface ToolSearchEntry {
  id: string;
  name: string;
  shortDescription: string;
  keywords: string[];
  tags: string[];
  category: string;
  subcategory?: string;
  icon: string;
  path: string;
}
