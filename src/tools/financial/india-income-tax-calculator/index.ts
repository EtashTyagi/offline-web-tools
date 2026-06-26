import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'india-income-tax-calculator',
  name: 'India Income Tax Calculator',
  shortDescription: 'Compare New vs Old regime income tax for FY 2024-25 with deductions and cess.',
  description:
    'Compare your India income tax under the New and Old regimes for FY 2024-25 (AY 2025-26). Enter your salary, other income, and deductions like 80C, 80D, NPS, HRA, and home loan interest, and see which regime costs less. The calculator applies the standard deduction, 87A rebate, and the 4% Health & Education Cess. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['india income tax', 'new regime', 'old regime', '87a rebate', '80c', '80d', 'nps', 'hra', 'cess', 'fy 2024-25'],
  tags: ['income tax calculator india', 'salary tax calculator', 'new vs old regime calculator', 'taxable income calculator', 'it return calculator'],
  icon: '🇮🇳',
  component: () => import('./IndiaIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'India Income Tax Calculator — Free & Offline',
    description:
      'Compare New vs Old regime income tax for FY 2024-25 with 80C, 80D, NPS, HRA, and cess. Runs entirely in your browser. No data leaves your device.',
    keywords: ['india income tax calculator', 'new regime vs old regime', '80c calculator', 'salary tax calculator'],
  },
};

export default tool;
