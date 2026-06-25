// Document-conversion helpers for the pandoc-WASM-backed Document Converter.
//
// Pure, side-effect-free logic lives here so Vitest can test it without the
// 56 MB pandoc WASM. The actual pandoc conversion runs in a Web Worker
// (pandoc.worker.ts) and is exercised by Playwright e2e tests.

export interface PandocFormat {
  id: string;
  label: string;
  ext: string;
  text: boolean;
}

// A curated but broad set of pandoc input formats (readers).
export const INPUT_FORMATS: PandocFormat[] = [
  { id: 'markdown', label: 'Markdown', ext: 'md', text: true },
  { id: 'gfm', label: 'GitHub-Flavored Markdown', ext: 'md', text: true },
  { id: 'commonmark', label: 'CommonMark', ext: 'md', text: true },
  { id: 'html', label: 'HTML', ext: 'html', text: true },
  { id: 'latex', label: 'LaTeX', ext: 'tex', text: true },
  { id: 'rst', label: 'reStructuredText', ext: 'rst', text: true },
  { id: 'asciidoc', label: 'AsciiDoc', ext: 'adoc', text: true },
  { id: 'djot', label: 'Djot', ext: 'dj', text: true },
  { id: 'org', label: 'Emacs Org', ext: 'org', text: true },
  { id: 'textile', label: 'Textile', ext: 'textile', text: true },
  { id: 'mediawiki', label: 'MediaWiki', ext: 'wiki', text: true },
  { id: 'plain', label: 'Plain text', ext: 'txt', text: true },
  { id: 'json', label: 'Pandoc JSON', ext: 'json', text: true },
  { id: 'ipynb', label: 'Jupyter Notebook', ext: 'ipynb', text: true },
  { id: 'docx', label: 'Word (docx)', ext: 'docx', text: false },
  { id: 'odt', label: 'OpenDocument (odt)', ext: 'odt', text: false },
  { id: 'rtf', label: 'Rich Text (rtf)', ext: 'rtf', text: false },
  { id: 'epub', label: 'EPUB', ext: 'epub', text: false },
  { id: 'opml', label: 'OPML', ext: 'opml', text: false },
  { id: 'biblatex', label: 'BibLaTeX', ext: 'bib', text: true },
  { id: 'bibtex', label: 'BibTeX', ext: 'bib', text: true },
];

// A curated set of pandoc output formats (writers). PDF is intentionally
// excluded: producing PDF needs an external engine (LaTeX/wkhtmltopdf) that
// the in-browser WASM build cannot ship.
export const OUTPUT_FORMATS: PandocFormat[] = [
  { id: 'html', label: 'HTML', ext: 'html', text: true },
  { id: 'markdown', label: 'Markdown', ext: 'md', text: true },
  { id: 'gfm', label: 'GitHub-Flavored Markdown', ext: 'md', text: true },
  { id: 'commonmark', label: 'CommonMark', ext: 'md', text: true },
  { id: 'plain', label: 'Plain text', ext: 'txt', text: true },
  { id: 'latex', label: 'LaTeX', ext: 'tex', text: true },
  { id: 'beamer', label: 'Beamer (LaTeX slides)', ext: 'tex', text: true },
  { id: 'rst', label: 'reStructuredText', ext: 'rst', text: true },
  { id: 'asciidoc', label: 'AsciiDoc', ext: 'adoc', text: true },
  { id: 'asciidoctor', label: 'AsciiDoctor', ext: 'adoc', text: true },
  { id: 'org', label: 'Emacs Org', ext: 'org', text: true },
  { id: 'man', label: 'Man page', ext: 'man', text: true },
  { id: 'texinfo', label: 'Texinfo', ext: 'texi', text: true },
  { id: 'context', label: 'ConTeXt', ext: 'tex', text: true },
  { id: 'typst', label: 'Typst', ext: 'typ', text: true },
  { id: 'djot', label: 'Djot', ext: 'dj', text: true },
  { id: 'textile', label: 'Textile', ext: 'textile', text: true },
  { id: 'mediawiki', label: 'MediaWiki', ext: 'wiki', text: true },
  { id: 'dokuwiki', label: 'DokuWiki', ext: 'txt', text: true },
  { id: 'json', label: 'Pandoc JSON', ext: 'json', text: true },
  { id: 'docx', label: 'Word (docx)', ext: 'docx', text: false },
  { id: 'odt', label: 'OpenDocument (odt)', ext: 'odt', text: false },
  { id: 'rtf', label: 'Rich Text (rtf)', ext: 'rtf', text: false },
  { id: 'epub', label: 'EPUB', ext: 'epub', text: false },
  { id: 'pptx', label: 'PowerPoint (pptx)', ext: 'pptx', text: false },
];

export function getInputFormat(id: string): PandocFormat | undefined {
  return INPUT_FORMATS.find((f) => f.id === id);
}

export function getOutputFormat(id: string): PandocFormat | undefined {
  return OUTPUT_FORMATS.find((f) => f.id === id);
}

const EXT_TO_INPUT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const f of INPUT_FORMATS) {
    const ext = f.ext.toLowerCase();
    if (!map[ext]) map[ext] = f.id;
  }
  // Common aliases.
  map['markdown'] = 'markdown';
  map['htm'] = 'html';
  map['adoc'] = 'asciidoc';
  map['asciidoc'] = 'asciidoc';
  map['tex'] = 'latex';
  map['wiki'] = 'mediawiki';
  return map;
})();

export function detectFormatByExtension(filename: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  if (!m) return null;
  return EXT_TO_INPUT[m[1].toLowerCase()] ?? null;
}

export interface ConvertOptionsInput {
  from: string;
  to: string;
  standalone?: boolean;
  toc?: boolean;
  numberSections?: boolean;
  wrap?: 'auto' | 'none' | 'preserve';
  outputFile?: string;
}

export function buildOptions(input: ConvertOptionsInput): Record<string, unknown> {
  const opts: Record<string, unknown> = { from: input.from, to: input.to };
  if (input.standalone) opts.standalone = true;
  if (input.toc) opts['table-of-contents'] = true;
  if (input.numberSections) opts['number-sections'] = true;
  if (input.wrap) opts.wrap = input.wrap;
  if (input.outputFile) opts['output-file'] = input.outputFile;
  return opts;
}

export function isTextOutput(outFormatId: string): boolean {
  return getOutputFormat(outFormatId)?.text ?? true;
}

export function outputFilename(inputName: string | null, outFormatId: string): string {
  const ext = getOutputFormat(outFormatId)?.ext ?? 'out';
  const base = inputName ? inputName.replace(/\.[a-z0-9]+$/i, '') : 'document';
  return `${base || 'document'}.${ext}`;
}
