import type { Tool } from '../../../types/tool';

// Heavy tool (56 MB pandoc WASM). Renders with client:visible via ToolLayout.
const tool: Tool = {
  id: 'document-converter',
  name: 'Document Converter',
  shortDescription: 'Convert documents between Markdown, HTML, docx, LaTeX, EPUB, and more, all in your browser.',
  description:
    'Convert documents from one format to another using the full pandoc engine compiled to WebAssembly and running entirely in your browser. Turn Markdown into HTML, Word, or EPUB, change HTML to Markdown or LaTeX, convert docx to Markdown, and many more combinations. The engine downloads once (about 56 MB) and then works offline. Nothing is uploaded.',
  category: 'files',
  keywords: [
    'document converter', 'pandoc', 'markdown to html', 'html to markdown', 'markdown to docx',
    'docx to markdown', 'markdown to pdf', 'markdown to latex', 'html to docx', 'markdown to epub',
    'rst to markdown', 'asciidoc converter', 'latex to html', 'markdown converter', 'file converter',
    'docx converter', 'epub converter', 'rtf converter', 'odt converter', 'pandoc online',
  ],
  tags: [
    'md to html', 'html to md', 'word to markdown', 'markdown to word',
    'markdown to odt', 'latex to markdown', 'markdown to rtf', 'rst to html',
    'pandoc in browser', 'convert docx', 'jupyter to markdown', 'html to latex',
  ],
  icon: '📄',
  component: () => import('./DocumentConverter.tsx'),
  heavy: true,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Document Converter — Markdown, HTML, DOCX, LaTeX (Offline)',
    description:
      'Convert documents between Markdown, HTML, Word, LaTeX, EPUB, RST, and more with pandoc in your browser. 100% client-side, nothing uploaded.',
    keywords: ['document converter', 'markdown to html', 'docx to markdown', 'html to markdown', 'pandoc online'],
  },
};

export default tool;
