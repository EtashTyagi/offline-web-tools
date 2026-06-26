import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'tax-comparer',
  name: 'Tax Comparer',
  shortDescription: 'Compare income tax and take-home pay across 8 countries from one income.',
  description:
    'Enter one gross income in your currency and the Tax Comparer converts it into each country\'s currency, runs that country\'s income tax engine for a single filer, and shows total tax, take-home pay, effective and marginal rates side by side. Charts rank the cheapest and most expensive countries to earn in. Exchange rates are approximate and baked in, and everything runs in your browser.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: [
    'tax comparison',
    'income tax comparison',
    'compare taxes',
    'take home pay by country',
    'international tax calculator',
    'salary comparison',
    'tax by country',
  ],
  tags: ['cross country tax', 'net salary comparison', 'global tax calculator', 'where to pay less tax'],
  icon: '⚖️',
  component: () => import('./TaxComparer.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Tax Comparer — Compare Income Tax Worldwide',
    description:
      'Compare income tax and take-home pay across the US, UK, Germany, France, Spain, Italy, the Netherlands, and India from one income. Runs in your browser.',
    keywords: ['tax comparer', 'income tax comparison', 'compare taxes by country', 'take home pay comparison'],
  },
};

export default tool;
