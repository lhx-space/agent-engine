import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from '@rstest/core';
import { ContextComposer } from '../src/context/context-composer';
import { FixedSizeChunker, MarkdownHeadingChunker } from '../src/documents/chunker';
import { DocumentIndex, loadDocuments } from '../src/documents/document-index';
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

describe('文档检索（DocumentIndex + loadDocuments + 注入）', () => {
  it('DocumentIndex 词法召回 top-k chunk', async () => {
    const index = new DocumentIndex({ topK: 2 });
    await index.addChunks([
      { text: '今天天气很好', metadata: {} },
      { text: '股市今天大跌', metadata: {} },
    ]);
    const hits = await index.retrieve('天气');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.text).toContain('天气');
  });

  it('loadDocuments 装载目录并跳过无适配器扩展名', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-engine-docs-'));
    await writeFile(join(dir, 'a.md'), '# 天气\n今天天气很好，适合出门。');
    await writeFile(join(dir, 'b.bin'), 'ignored binary');
    const index = await loadDocuments({
      sources: [dir],
      chunking: { strategy: 'heading', size: 1000, overlap: 0 },
      topK: 2,
    });
    const hits = await index.retrieve('天气', 2);
    expect(hits.some((chunk) => chunk.text.includes('天气'))).toBe(true);
  });

  it('ContextComposer 注入 [文档] 片段', async () => {
    const index = new DocumentIndex({ topK: 2 });
    await index.addChunks([
      { text: 'Kubernetes 故障排查顺序：events → describe → logs。', metadata: {} },
    ]);
    const composer = new ContextComposer({
      systemPrompt: '你是运维助手。',
      rules: [],
      documentIndex: index,
    });
    const { systemPrompt } = await composer.compose('k8s 故障怎么排查');
    expect(systemPrompt).toContain('[文档]');
    expect(systemPrompt).toContain('Kubernetes');
  });
});
