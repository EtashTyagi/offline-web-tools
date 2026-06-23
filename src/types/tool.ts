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
}

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
  category: string;
  subcategory?: string;
  icon: string;
  path: string;
}
