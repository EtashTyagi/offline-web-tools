import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'investment-calculator',
  name: 'Investment Calculator (FVIFA)',
  shortDescription: 'Project investment growth with a lump sum and multiple recurring contributions via FVIFA.',
  description:
    'Project the future value of an investment using an initial lump sum plus recurring contributions. Combine several contribution streams, like a monthly SIP with an annual top-up, and see the growth, interest, and schedule. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'investing',
  keywords: ['fvifa', 'investment', 'future value', 'annuity', 'compound interest', 'sip', 'lump sum', 'recurring contribution'],
  tags: ['sip calculator', 'future value calculator', 'annuity calculator', 'compound interest calculator', 'wealth calculator', 'recurring investment calculator'],
  icon: '📈',
  component: () => import('./InvestmentCalculator.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Investment Calculator (FVIFA) — Free & Offline',
    description:
      'Project investment future value with a lump sum and recurring contributions using FVIFA. Runs entirely in your browser. No data leaves your device.',
    keywords: ['fvifa calculator', 'investment calculator', 'future value calculator', 'sip calculator'],
  },
};

export default tool;
