import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'france-income-tax-calculator',
  name: 'France Income Tax Calculator',
  shortDescription: 'Estimate French income tax (IR) for revenus 2025 with quotient familial and décote.',
  description:
    'Estimate your French impôt sur le revenu for revenus 2025 (declared 2026). The calculator applies the 5-bracket progressive scale per part of quotient familial, the 10% frais professionnels deduction, the plafonnement du quotient familial, and the décote for modest incomes. Choose your household situation to set your number of parts. Social charges (CSG/CRDS) are not included. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['france income tax', 'impôt sur le revenu', 'quotient familial', 'décote', 'barème progressif', 'revenus 2025', 'frais professionnels'],
  tags: ['french tax calculator', 'impôt sur le revenu calcul', 'quotient familial calcul', 'net imposable calculator', 'bareme ir calcul'],
  icon: '🇫🇷',
  component: () => import('./FranceIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'France Income Tax Calculator — Free & Offline',
    description:
      'Estimate French impôt sur le revenu for revenus 2025 with quotient familial and décote. Runs entirely in your browser. No data leaves your device.',
    keywords: ['france income tax calculator', 'impot sur le revenu', 'quotient familial calculator', 'bareme ir'],
  },
};

export default tool;
