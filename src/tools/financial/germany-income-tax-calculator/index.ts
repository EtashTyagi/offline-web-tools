import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'germany-income-tax-calculator',
  name: 'Germany Income Tax Calculator',
  shortDescription: 'Estimate German income tax (§32a EStG) for 2025 with Soli and church tax.',
  description:
    'Estimate your German Einkommensteuer for tax year 2025 using the official §32a EStG progressive tariff, the Splittingverfahren for married couples, the Solidaritätszuschlag (Soli) with its €19,950 / €39,900 exemption, and optional Kirchensteuer. Enter your gross income to see your tax bands, marginal and effective rates, and take-home pay. Pension and health insurance deductions are not fully modelled. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['germany income tax', 'einkommensteuer', 'solidaritätszuschlag', 'soli', 'kirchensteuer', 'splittingverfahren', 'grundfreibetrag', 'marginal rate'],
  tags: ['german tax calculator', 'einkommensteuer calculator', 'soli calculator', 'netto bruto rechner', 'lohnsteuer calculator'],
  icon: '🇩🇪',
  component: () => import('./GermanyIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'Germany Income Tax Calculator — Free & Offline',
    description:
      'Estimate German Einkommensteuer for 2025 with the §32a tariff, Soli, and church tax. Runs entirely in your browser. No data leaves your device.',
    keywords: ['germany income tax calculator', 'einkommensteuer rechner', 'soli calculator', 'net salary germany'],
  },
};

export default tool;
