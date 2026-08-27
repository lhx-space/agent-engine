import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@rstest/core';
import { DocxNormalizer, EpubNormalizer, PdfNormalizer, loadDocuments } from '../src/index';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('二进制文档归一化器', () => {
  it('PdfNormalizer 抽取文本层', async () => {
    const content = await readFile(join(fixturesDir, 'sample.pdf'));
    const doc = await new PdfNormalizer().normalize({ path: 'sample.pdf', content });
    expect(doc.markdown).toContain('Hello Agent Engine PDF');
  });

  it('DocxNormalizer 归一化为 Markdown（标题结构保留）', async () => {
    const content = await readFile(join(fixturesDir, 'sample.docx'));
    const doc = await new DocxNormalizer().normalize({ path: 'sample.docx', content });
    expect(doc.markdown).toContain('# Agent Engine');
    expect(doc.markdown).toContain('This is a docx fixture.');
  });

  it('EpubNormalizer 按章节归一化为 Markdown', async () => {
    const doc = await new EpubNormalizer().normalize({
      path: join(fixturesDir, 'sample.epub'),
      content: '',
    });
    expect(doc.markdown).toContain('Hello from epub chapter one.');
    expect(doc.markdown).toContain('Hello from epub chapter two.');
    expect(doc.metadata.title).toBe('Test Book');
  });

  it('loadDocuments 分派二进制扩展名（pdf/docx/epub）', async () => {
    const index = await loadDocuments({
      sources: [fixturesDir],
      chunking: { strategy: 'fixed', size: 1000, overlap: 0 },
      topK: 4,
    });
    const pdfHits = await index.retrieve('PDF');
    const docxHits = await index.retrieve('docx fixture');
    const epubHits = await index.retrieve('epub chapter');
    expect(pdfHits.some((chunk) => chunk.text.includes('PDF'))).toBe(true);
    expect(docxHits.some((chunk) => chunk.text.includes('docx fixture'))).toBe(true);
    expect(epubHits.some((chunk) => chunk.text.includes('epub chapter'))).toBe(true);
  });
});
