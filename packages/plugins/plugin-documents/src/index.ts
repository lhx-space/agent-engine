import type { DocumentsConfig } from '@agent-engine/config';
import type { ContextContributor } from '@agent-engine/core/context';
import type { EmbeddingProvider } from '@agent-engine/core/embedding';
import type { Plugin } from '@agent-engine/core/plugins';
import { DocumentIndex, loadDocuments } from './document-index';

export { TextNormalizer } from './text-normalizer';
export { HtmlNormalizer } from './html-normalizer';
export { PdfNormalizer } from './pdf-normalizer';
export { DocxNormalizer } from './docx-normalizer';
export { EpubNormalizer } from './epub-normalizer';
export { FixedSizeChunker, MarkdownHeadingChunker } from './chunker';
export { DocumentIndex, loadDocuments } from './document-index';
export type {
  Chunk,
  Chunker,
  ChunkerOptions,
  Document,
  DocumentNormalizer,
  NormalizeInput,
} from './types';

/** plugin-documents 工厂选项。 */
export interface DocumentsPluginOptions {
  /** 语义召回 provider（缺省仅 BM25 词法检索）。 */
  embedding?: EmbeddingProvider;
}

/**
 * 创建文档 RAG 插件：`install` 时装载文档（枚举 sources → 归一化 → 分块 → 索引），
 * 注册一个 `ContextContributor`，每次 run 检索命中 chunk 并注入 `[文档]` 文本。
 * `config.documents` 字段的解释权移交本插件（D1-A：字段不变、零迁移）。
 */
export function createDocumentsPlugin(
  documents: DocumentsConfig,
  options: DocumentsPluginOptions = {},
): Plugin {
  return {
    name: '@agent-engine/plugin-documents',
    description: '文档 RAG（归一化 → 分块 → 索引 → 检索注入 [文档]）',
    version: '0.1.0',
    tags: ['documents', 'rag', '文档'],
    async install(ctx) {
      const index: DocumentIndex = await loadDocuments(documents, options.embedding);
      const contributor: ContextContributor = {
        name: '@agent-engine/plugin-documents',
        async contribute({ userInput }) {
          const chunks = await index.retrieve(userInput);
          if (chunks.length === 0) return undefined;
          const text = chunks.map((chunk) => chunk.text).join('\n\n');
          return { text: `[文档]\n${text}` };
        },
      };
      ctx.registerContextContributor(contributor);
    },
  };
}
