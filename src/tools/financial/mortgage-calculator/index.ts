import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'mortgage-calculator',
  name: 'Mortgage Calculator',
  shortDescription: 'Estimate monthly mortgage payments from loan amount, rate, and term.',
  description:
    'Estimate your monthly mortgage payment from the loan amount, interest rate, and term. See the total interest you would pay over the life of the loan. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'loans',
  keywords: ['mortgage', 'loan', 'interest', 'monthly payment', 'amortization'],
  tags: ['home loan', 'home loan calculator', 'house loan', 'home financing', 'property loan', 'housing loan'],
  icon: '🏦',
  component: () => import('./MortgageCalculator.tsx'),
  heavy: false,
  featured: true,
  status: 'beta',
  seo: {
    title: 'Mortgage Calculator — Free & Offline',
    description:
      'Calculate monthly mortgage payments, interest, and amortization. Runs entirely in your browser. No data leaves your device.',
    keywords: ['mortgage calculator', 'loan payment calculator', 'amortization'],
  },
};

export default tool;
