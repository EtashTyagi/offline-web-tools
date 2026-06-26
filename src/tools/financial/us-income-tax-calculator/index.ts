import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'us-income-tax-calculator',
  name: 'US Income Tax Calculator',
  shortDescription: 'Estimate US federal income tax, FICA, and self-employment tax for tax year 2024.',
  description:
    'Estimate your US federal income tax for tax year 2024 using the official federal brackets and standard deductions. Enter wages, self-employment income, and other income, and the calculator figures your income tax, FICA (Social Security and Medicare), self-employment tax, effective and marginal rates, and take-home pay. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['us income tax', 'federal tax', 'fica', 'self-employment tax', 'medicare', 'social security', 'marginal rate', 'effective rate', 'w-2'],
  tags: ['federal tax calculator', 'take home pay calculator', 'paycheck tax estimator', 'self employment tax calculator', 'irs tax estimator'],
  icon: '🇺🇸',
  component: () => import('./UsIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'US Income Tax Calculator — Free & Offline',
    description:
      'Estimate US federal income tax, FICA, and self-employment tax for 2024 using official brackets. Runs entirely in your browser. No data leaves your device.',
    keywords: ['us income tax calculator', 'federal tax calculator', 'self employment tax', 'fica calculator'],
  },
};

export default tool;
