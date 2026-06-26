import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'tax-calculators',
  name: 'Tax Calculators',
  shortDescription: 'Income tax calculators for 8 countries plus a cross-country tax comparer.',
  description:
    'A hub for income tax calculators. Pick a country to estimate your income tax with that country\'s brackets, deductions, and surcharges, all running in your browser. Or open the Tax Comparer to enter one income and see how take-home pay differs across all eight countries. Nothing is uploaded.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: [
    'income tax',
    'tax calculator',
    'us income tax',
    'uk income tax',
    'germany income tax',
    'india income tax',
    'france income tax',
    'spain income tax',
    'italy income tax',
    'netherlands income tax',
    'tax comparison',
  ],
  tags: ['salary tax', 'take home pay', 'net pay calculator', 'tax estimator', 'paycheck tax'],
  icon: '🧮',
  component: () => import('./TaxCalculators.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Income Tax Calculators — Free & Offline',
    description:
      'Country income tax calculators for the US, UK, Germany, France, Spain, Italy, the Netherlands, and India, plus a cross-country tax comparer.',
    keywords: ['income tax calculator', 'tax comparer', 'country tax calculator', 'salary tax'],
  },
};

export default tool;
