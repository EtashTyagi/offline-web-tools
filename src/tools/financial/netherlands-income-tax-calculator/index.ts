import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'netherlands-income-tax-calculator',
  name: 'Netherlands Income Tax Calculator',
  shortDescription: 'Estimate Dutch Box 1 income tax for 2025 with heffingskortingen.',
  description:
    'Estimate your Dutch income tax in Box 1 for tax year 2025, with rates that include social security contributions. The calculator applies the three Box 1 brackets plus the algemene heffingskorting and arbeidskorting tax credits, and shows your tax bands, marginal and effective rates, and take-home pay. It assumes you are below AOW (state pension) age for the whole year and does not cover Box 2 or Box 3 income. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['netherlands income tax', 'box 1', 'heffingskorting', 'arbeidskorting', 'algemene heffingskorting', 'loonbelasting', 'aow', '2025'],
  tags: ['dutch tax calculator', 'netherlands salary calculator', 'net salary netherlands', 'inkomstenbelasting calculator', 'bruto netto calculator'],
  icon: '🇳🇱',
  component: () => import('./NetherlandsIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'Netherlands Income Tax Calculator — Free & Offline',
    description:
      'Estimate Dutch Box 1 income tax for 2025 with heffingskortingen and social security. Runs entirely in your browser. No data leaves your device.',
    keywords: ['netherlands income tax calculator', 'dutch box 1 calculator', 'net salary netherlands', 'heffingskorting'],
  },
};

export default tool;
