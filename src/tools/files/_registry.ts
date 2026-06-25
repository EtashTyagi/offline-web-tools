import type { Tool } from '../../types/tool';
import imageFormatConverter from './image-format-converter';
import documentConverter from './document-converter';

export const tools: Tool[] = [
  imageFormatConverter,
  documentConverter,
];
