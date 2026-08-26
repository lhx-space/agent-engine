import { describe, expect, it } from '@rstest/core';
import { FixedSizeChunker, MarkdownHeadingChunker } from '../src/documents/chunker';
import { HtmlNormalizer } from '../src/documents/html-normalizer';
import { TextNormalizer } from '../src/documents/text-normalizer';

describe('文档归一化层', () => {
  it('TextNormalizer 透传文本', async () => {
    const doc = await new TextNormalizer().normalize({ path: 'a.md', content: '# 标题' });
    expect(doc.path).toBe('a.md');
    expect(doc.markdown).toBe('# 标题');
  });

  it('HtmlNormalizer 把 HTML 归一化为 Markdown', async () => {
    const doc = await new HtmlNormalizer().normalize({
      path: 'a.html',
      content: '<h1>标题</h1><p>正文</p>',
    });
    expect(doc.markdown).toContain('# 标题');
    expect(doc.markdown).toContain('正文');
  });
});

describe('分块层', () => {
  it('FixedSizeChunker 按 size 切块', () => {
    const chunks = new FixedSizeChunker({ size: 3 }).chunk('abcdef');
    expect(chunks.map((chunk) => chunk.text)).toEqual(['abc', 'def']);
  });

  it('FixedSizeChunker 支持 overlap', () => {
    const chunks = new FixedSizeChunker({ size: 3, overlap: 1 }).chunk('abcdef');
    expect(chunks.map((chunk) => chunk.text)).toEqual(['abc', 'cde', 'ef']);
  });

  it('MarkdownHeadingChunker 按标题切段并携带标题 metadata', () => {
    const chunks = new MarkdownHeadingChunker().chunk('# A\nbody A\n## B\nbody B');
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.metadata.heading).toBe('A');
    expect(chunks[1]?.metadata.heading).toBe('B');
    expect(chunks[0]?.text).toContain('body A');
    expect(chunks[1]?.text).toContain('body B');
  });
});
