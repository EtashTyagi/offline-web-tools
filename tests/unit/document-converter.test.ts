import { describe, it, expect } from 'vitest';
import {
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  getInputFormat,
  getOutputFormat,
  detectFormatByExtension,
  buildOptions,
  isTextOutput,
  outputFilename,
} from '../../src/tools/files/document-converter/formats';

describe('format registries', () => {
  it('has unique ids in each list', () => {
    const inIds = INPUT_FORMATS.map((f) => f.id);
    const outIds = OUTPUT_FORMATS.map((f) => f.id);
    expect(new Set(inIds).size).toBe(inIds.length);
    expect(new Set(outIds).size).toBe(outIds.length);
  });

  it('includes common formats', () => {
    expect(INPUT_FORMATS.some((f) => f.id === 'markdown')).toBe(true);
    expect(INPUT_FORMATS.some((f) => f.id === 'docx')).toBe(true);
    expect(OUTPUT_FORMATS.some((f) => f.id === 'html')).toBe(true);
    expect(OUTPUT_FORMATS.some((f) => f.id === 'epub')).toBe(true);
  });

  it('excludes PDF from outputs', () => {
    expect(OUTPUT_FORMATS.some((f) => f.id === 'pdf')).toBe(false);
  });

  it('classifies text vs binary formats', () => {
    expect(getInputFormat('docx')?.text).toBe(false);
    expect(getInputFormat('epub')?.text).toBe(false);
    expect(getInputFormat('markdown')?.text).toBe(true);
    expect(getOutputFormat('docx')?.text).toBe(false);
    expect(getOutputFormat('html')?.text).toBe(true);
  });

  it('returns undefined for unknown ids', () => {
    expect(getInputFormat('nope')).toBeUndefined();
    expect(getOutputFormat('nope')).toBeUndefined();
  });
});

describe('detectFormatByExtension', () => {
  it('maps common extensions', () => {
    expect(detectFormatByExtension('doc.md')).toBe('markdown');
    expect(detectFormatByExtension('page.html')).toBe('html');
    expect(detectFormatByExtension('paper.tex')).toBe('latex');
    expect(detectFormatByExtension('file.docx')).toBe('docx');
    expect(detectFormatByExtension('book.epub')).toBe('epub');
    expect(detectFormatByExtension('notes.org')).toBe('org');
  });

  it('handles aliases', () => {
    expect(detectFormatByExtension('page.htm')).toBe('html');
    expect(detectFormatByExtension('doc.adoc')).toBe('asciidoc');
  });

  it('is case-insensitive', () => {
    expect(detectFormatByExtension('FILE.MD')).toBe('markdown');
    expect(detectFormatByExtension('BOOK.EPUB')).toBe('epub');
  });

  it('returns null for unknown extensions', () => {
    expect(detectFormatByExtension('file.xyz')).toBeNull();
  });

  it('returns null when there is no extension', () => {
    expect(detectFormatByExtension('README')).toBeNull();
  });
});

describe('buildOptions', () => {
  it('always sets from and to', () => {
    const opts = buildOptions({ from: 'markdown', to: 'html' });
    expect(opts.from).toBe('markdown');
    expect(opts.to).toBe('html');
    expect(opts.standalone).toBeUndefined();
    expect(opts['table-of-contents']).toBeUndefined();
    expect(opts['output-file']).toBeUndefined();
  });

  it('sets optional flags only when enabled', () => {
    const opts = buildOptions({
      from: 'markdown',
      to: 'html',
      standalone: true,
      toc: true,
      numberSections: true,
      wrap: 'none',
      outputFile: 'out.html',
    });
    expect(opts.standalone).toBe(true);
    expect(opts['table-of-contents']).toBe(true);
    expect(opts['number-sections']).toBe(true);
    expect(opts.wrap).toBe('none');
    expect(opts['output-file']).toBe('out.html');
  });

  it('does not set output-file when omitted', () => {
    expect(buildOptions({ from: 'html', to: 'markdown' })['output-file']).toBeUndefined();
  });
});

describe('isTextOutput', () => {
  it('returns true for text formats', () => {
    expect(isTextOutput('html')).toBe(true);
    expect(isTextOutput('markdown')).toBe(true);
    expect(isTextOutput('latex')).toBe(true);
  });

  it('returns false for binary formats', () => {
    expect(isTextOutput('docx')).toBe(false);
    expect(isTextOutput('epub')).toBe(false);
    expect(isTextOutput('pptx')).toBe(false);
  });

  it('defaults to true for unknown formats', () => {
    expect(isTextOutput('unknown')).toBe(true);
  });
});

describe('outputFilename', () => {
  it('swaps the extension from the input name', () => {
    expect(outputFilename('report.md', 'html')).toBe('report.html');
    expect(outputFilename('notes.txt', 'docx')).toBe('notes.docx');
  });

  it('falls back to "document" when no input name', () => {
    expect(outputFilename(null, 'html')).toBe('document.html');
  });

  it('handles names with multiple dots', () => {
    expect(outputFilename('my.file.name.md', 'html')).toBe('my.file.name.html');
  });

  it('keeps the name when it has no extension', () => {
    expect(outputFilename('README', 'html')).toBe('README.html');
  });
});
