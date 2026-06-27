import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'json-formatter',
  name: 'JSON Formatter',
  shortDescription: 'Pretty-print, minify, validate, sort, and clean JSON in your browser.',
  description:
    'Format JSON with a configurable indent, minify it to a single line, or just validate the syntax. Sort object keys alphabetically, drop null values, and escape non-ASCII characters when you need pure ASCII output. Errors point at the exact line and column. Runs entirely in your browser.',
  category: 'dev',
  keywords: [
    'json', 'formatter', 'beautifier', 'pretty print', 'prettify',
    'minify', 'validate', 'parser', 'lint', 'json sort',
    'escape unicode', 'drop null',
  ],
  tags: [
    'json beautifier', 'json pretty print', 'json minifier', 'json validator',
    'json lint', 'json viewer', 'sort json keys', 'json to one line',
    'json escape unicode',
  ],
  icon: '{ }',
  component: () => import('./JsonFormatter.tsx'),
  heavy: false,
  featured: false,
  status: 'active',
  seo: {
    title: 'JSON Formatter — Pretty Print, Minify, Validate',
    description:
      'Format, minify, and validate JSON in your browser. Sort keys, drop nulls, escape unicode. 100% offline, no upload.',
    keywords: ['json formatter', 'json pretty print', 'json minify', 'json validator', 'json beautifier'],
  },
};

export default tool;