import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'image-format-converter',
  name: 'Image Format Converter',
  shortDescription: 'Convert images between PNG, JPEG, and WebP in your browser. Batch, resize, and quality control.',
  description:
    'Convert images from one format to another entirely in your browser. Drop PNG, JPEG, WebP, GIF, BMP, AVIF, SVG, or ICO files and re-encode them as PNG, JPEG, or WebP. Adjust quality, resize by width, height, percentage, or max side, and flatten transparency with a background color. Batch convert many files at once. Nothing is uploaded.',
  category: 'files',
  keywords: [
    'image converter', 'png to jpg', 'jpg to png', 'webp converter', 'image to webp',
    'png to webp', 'jpg to webp', 'webp to png', 'convert image', 'batch image converter',
    'resize image', 'compress image', 'image format', 'raster converter', 'avif converter',
  ],
  tags: [
    'png to jpeg', 'jpeg to png', 'webp to jpeg', 'change image format',
    'image file converter', 'compress png', 'compress jpeg', 'photo format converter',
    'gif to png', 'bmp to png',
  ],
  icon: '🖼️',
  component: () => import('./ImageFormatConverter.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Image Format Converter — PNG, JPG, WebP (Offline)',
    description:
      'Convert images between PNG, JPEG, and WebP in your browser. Batch convert, resize, and control quality. 100% client-side, nothing uploaded.',
    keywords: ['image converter', 'png to jpg', 'jpg to webp', 'webp to png', 'batch image converter'],
  },
};

export default tool;
