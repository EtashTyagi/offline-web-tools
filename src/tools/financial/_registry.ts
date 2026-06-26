import type { Tool } from '../../types/tool';
import mortgage from './mortgage-calculator';
import investment from './investment-calculator';

export const tools: Tool[] = [
  mortgage,
  investment,
];
