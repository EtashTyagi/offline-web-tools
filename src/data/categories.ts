import type { Category } from '../types/tool';

export const categories: Category[] = [
  {
    slug: 'financial',
    name: 'Financial',
    icon: '💰',
    description: 'Calculators and tools for loans, investments, taxes, and budgeting.',
    subcategories: [
      { slug: 'loans', name: 'Loans' },
      { slug: 'investing', name: 'Investing' },
      { slug: 'taxes', name: 'Taxes' },
    ],
  },
  {
    slug: 'dev',
    name: 'Developer',
    icon: '🛠️',
    description: 'Interpreters, code formatters, and analysis tools for developers.',
    subcategories: [
      { slug: 'networking', name: 'Networking' },
    ],
  },
  {
    slug: 'files',
    name: 'Files & Conversion',
    icon: '📁',
    description: 'Convert, merge, and transform files entirely in your browser.',
  },
  {
    slug: 'images',
    name: 'Images',
    icon: '🖼️',
    description: 'Edit, convert, upscale, and manipulate images without uploading.',
    subcategories: [
      { slug: 'edit', name: 'Editing' },
      { slug: 'convert', name: 'Conversion' },
      { slug: 'ai', name: 'AI' },
    ],
  },
  {
    slug: 'ai',
    name: 'AI & ML',
    icon: '🤖',
    description: 'Client-side LLMs, image generation, and machine learning tools.',
  },
  {
    slug: 'text',
    name: 'Text & Data',
    icon: '📝',
    description: 'Formatters, encoders, parsers, and data transformation tools.',
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function validCategorySlug(slug: string): boolean {
  return categories.some((c) => c.slug === slug);
}

export function validSubcategorySlug(
  categorySlug: string,
  subcategorySlug: string,
): boolean {
  const cat = getCategory(categorySlug);
  return !!cat?.subcategories?.some((s) => s.slug === subcategorySlug);
}
