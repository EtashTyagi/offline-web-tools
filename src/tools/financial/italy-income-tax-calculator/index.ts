import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'italy-income-tax-calculator',
  name: 'Italy Income Tax Calculator',
  shortDescription: 'Estimate Italian IRPEF for 2025 with national, regional and municipal surtaxes.',
  description:
    'Estimate your Italian personal income tax (IRPEF) for tax year 2025. The calculator applies the national brackets of 23%, 35% and 43% plus the regional and municipal surtaxes (addizionali) on the same taxable base. Enter your taxable income and your local surtax rates to see your tax bands, marginal and effective rates, and take-home pay. The no-tax-area deductions for low incomes are not fully modelled. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['italy income tax', 'irpef', 'addizionale regionale', 'addizionale comunale', 'scaglioni', 'no tax area', '2025'],
  tags: ['italian tax calculator', 'irpef calculator', 'net salary italy', 'italian income tax estimator', 'calcolo irpef'],
  icon: '🇮🇹',
  component: () => import('./ItalyIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'Italy Income Tax Calculator — Free & Offline',
    description:
      'Estimate Italian IRPEF for 2025 with national brackets plus regional and municipal surtaxes. Runs entirely in your browser. No data leaves your device.',
    keywords: ['italy income tax calculator', 'irpef calculator', 'italian tax estimator', 'net salary italy'],
  },
};

export default tool;
