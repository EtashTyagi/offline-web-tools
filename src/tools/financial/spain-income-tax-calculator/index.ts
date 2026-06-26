import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'spain-income-tax-calculator',
  name: 'Spain Income Tax Calculator',
  shortDescription: 'Estimate Spanish IRPF for 2025 with the state and regional brackets.',
  description:
    'Estimate your Spanish personal income tax (IRPF) for fiscal year 2025. The calculator uses the combined state plus common-regional withholding brackets and the €5,550 personal minimum, applied to your general taxable income. Regional rates vary by autonomous community and savings income is taxed separately, so both are noted but not modelled. Everything runs in your browser, so your numbers stay private.',
  category: 'financial',
  subcategory: 'taxes',
  keywords: ['spain income tax', 'irpf', 'impuesto sobre la renta', 'mínimo personal', 'tramos', 'retención', 'autonomous community'],
  tags: ['irpf calculator', 'spain tax calculator', 'spanish income tax estimator', 'retencion irpf calculadora', 'renta calculadora'],
  icon: '🇪🇸',
  component: () => import('./SpainIncomeTaxCalculator.tsx'),
  heavy: false,
  featured: false,
  hidden: true,
  status: 'beta',
  seo: {
    title: 'Spain Income Tax Calculator — Free & Offline',
    description:
      'Estimate Spanish IRPF for 2025 with the state and regional brackets and the personal minimum. Runs entirely in your browser. No data leaves your device.',
    keywords: ['spain income tax calculator', 'irpf calculator', 'spanish tax estimator', 'renta 2025'],
  },
};

export default tool;
