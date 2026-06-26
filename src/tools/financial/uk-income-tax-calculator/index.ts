import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'uk-income-tax-calculator',
  name: 'UK Income Tax Calculator',
  shortDescription: 'Estimate UK income tax and National Insurance for tax year 2025/26.',
  description:
    'Estimate your UK income tax and Class 1 National Insurance for tax year 2025/26 (6 April 2025 to 5 April 2026). Enter your gross income and any tax-relieved pension contributions to see your tax bands, the £12,570 personal allowance taper above £100,000, effective and marginal rates, and take-home pay. Covers England, Wales and Northern Ireland. Scotland uses different bands. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['uk income tax', 'national insurance', 'personal allowance', 'income tax bands', 'paye', 'take home pay', 'tax year 2025'],
  tags: ['uk salary calculator', 'take home pay calculator', 'national insurance calculator', 'income tax estimator', 'net pay calculator'],
  icon: '🇬🇧',
  component: () => import('./UkIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'UK Income Tax Calculator — Free & Offline',
    description:
      'Estimate UK income tax and National Insurance for 2025/26, with the personal allowance taper. Runs in your browser. No data leaves your device.',
    keywords: ['uk income tax calculator', 'national insurance calculator', 'take home pay uk', 'paye calculator'],
  },
};

export default tool;
