import type { Tool } from '../../types/tool';
import mortgage from './mortgage-calculator';
import investment from './investment-calculator';
import usIncomeTax from './us-income-tax-calculator';
import indiaIncomeTax from './india-income-tax-calculator';
import ukIncomeTax from './uk-income-tax-calculator';
import germanyIncomeTax from './germany-income-tax-calculator';
import franceIncomeTax from './france-income-tax-calculator';
import spainIncomeTax from './spain-income-tax-calculator';
import italyIncomeTax from './italy-income-tax-calculator';
import netherlandsIncomeTax from './netherlands-income-tax-calculator';
import taxCalculators from './tax-calculators';
import taxComparer from './tax-comparer';

export const tools: Tool[] = [
  mortgage,
  investment,
  taxCalculators,
  taxComparer,
  usIncomeTax,
  indiaIncomeTax,
  ukIncomeTax,
  germanyIncomeTax,
  franceIncomeTax,
  spainIncomeTax,
  italyIncomeTax,
  netherlandsIncomeTax,
];
