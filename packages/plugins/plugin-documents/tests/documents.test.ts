import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from '@rstest/core';
import type { ContextContributor } from '@lhx-agent-engine/core/context';
import type { PluginContext } from '@lhx-agent-engine/core/plugins';
import {
  DocumentIndex,
  FixedSizeChunker,
  HtmlNormalizer,
  MarkdownHeadingChunker,
  TextNormalizer,
  createDocumentsPlugin,
  loadDocuments,
} from '../src/index';

function makeCtx(): { ctx: PluginContext; contributors: ContextContributor[] } {
  const contributors: ContextContributor[] = [];
  const ctx = {
    registerContextContributor: (contributor: ContextContributor) => contributors.push(contributor),
  } as PluginContext;
  return { ctx, contributors };
}

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

  it('MarkdownHeadingChunker 按标题切段并携带标题 metadata', () => {
    const chunks = new MarkdownHeadingChunker().chunk('# A\nbody A\n## B\nbody B');
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.metadata.heading).toBe('A');
    expect(chunks[1]?.metadata.heading).toBe('B');
  });
});

describe('DocumentIndex + loadDocuments', () => {
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
});

describe('createDocumentsPlugin', () => {
  it('装载文档并注册 contributor，检索命中注入 [文档]', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-engine-docs-'));
    await writeFile(
      join(dir, 'a.md'),
      '# K8s\nKubernetes 故障排查顺序：events → describe → logs。',
    );

    const { ctx, contributors } = makeCtx();
    await createDocumentsPlugin({
      sources: [dir],
      chunking: { strategy: 'fixed', size: 1000, overlap: 0 },
      topK: 2,
    }).install(ctx);

    expect(contributors).toHaveLength(1);
    expect(contributors[0]?.name).toBe('@lhx-agent-engine/plugin-documents');
    const contribution = await contributors[0]!.contribute({ userInput: 'k8s 故障怎么排查' });
    expect(contribution?.text).toContain('[文档]');
    expect(contribution?.text).toContain('Kubernetes');
  });
});
