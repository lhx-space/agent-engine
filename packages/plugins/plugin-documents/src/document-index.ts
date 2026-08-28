import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { DocumentsConfig } from '@lhx-agent-engine/config';
import type { EmbeddingProvider } from '@lhx-agent-engine/core/embedding';
import { hybridRetrieve, InMemoryVectorStore } from '@lhx-agent-engine/core/retrieval';
import type { RankedCandidate, VectorStore } from '@lhx-agent-engine/core/retrieval';
import MiniSearch from 'minisearch';
import { FixedSizeChunker, MarkdownHeadingChunker } from './chunker';
import { DocxNormalizer } from './docx-normalizer';
import { EpubNormalizer } from './epub-normalizer';
import { HtmlNormalizer } from './html-normalizer';
import { PdfNormalizer } from './pdf-normalizer';
import { TextNormalizer } from './text-normalizer';
import type { Chunk, Chunker, DocumentNormalizer } from './types';

/** 中文分词（Node 内置 Intl.Segmenter，word 粒度，零依赖）。 */
function segment(text: string): string[] {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  return [...segmenter.segment(text)].map((s) => s.segment).filter((s) => s.trim() !== '');
}

export interface DocumentIndexOptions {
  /** 每次检索的 top-k 数量（默认 4）。 */
  topK?: number;
  /** 语义召回的向量化 provider；缺省时仅 BM25 词法检索。 */
  embedding?: EmbeddingProvider;
  /** 语义召回的向量库；缺省且提供 `embedding` 时内部建 `InMemoryVectorStore`。 */
  vectorStore?: VectorStore;
}

/** 文档检索索引：BM25 词法检索；提供 `embedding` 时融合向量语义召回（RRF）。 */
export class DocumentIndex {
  private readonly chunks = new Map<string, Chunk>();
  private readonly index: MiniSearch;
  private readonly topK: number;
  private readonly embedding: EmbeddingProvider | undefined;
  private readonly vectorStore: VectorStore | undefined;
  private nextId = 0;

  constructor(options: DocumentIndexOptions = {}) {
    this.topK = options.topK ?? 4;
    this.embedding = options.embedding;
    this.vectorStore =
      options.vectorStore ?? (options.embedding ? new InMemoryVectorStore() : undefined);
    this.index = new MiniSearch({
      fields: ['text'],
      tokenize: (text) => segment(text),
    });
  }

  /** 追加 chunk（提供 embedding 时同步向量化入库）。 */
  async addChunks(chunks: Chunk[]): Promise<void> {
    for (const chunk of chunks) {
      const id = `chunk-${this.nextId}`;
      this.nextId += 1;
      this.chunks.set(id, chunk);
      this.index.add({ id, text: chunk.text });
      if (this.embedding && this.vectorStore) {
        const [vector] = await this.embedding.embed([chunk.text]);
        if (vector) await this.vectorStore.add([{ id, vector, metadata: { text: chunk.text } }]);
      }
    }
  }

  /** 召回 top-k chunk：无 embedding 为 BM25；有 embedding 为 BM25 + 向量 RRF 融合。 */
  async retrieve(query: string, topK = this.topK): Promise<Chunk[]> {
    if (!this.embedding || !this.vectorStore) {
      return this.toChunks(this.lexicalCandidates(query, topK).map((candidate) => candidate.id));
    }
    const fused = await hybridRetrieve(query, topK, {
      embedding: this.embedding,
      vectorStore: this.vectorStore,
      lexical: (q, k) => this.lexicalCandidates(q, k),
    });
    return this.toChunks(fused.map((candidate) => candidate.id));
  }

  private lexicalCandidates(query: string, topK: number): RankedCandidate[] {
    return this.index
      .search(query)
      .slice(0, topK)
      .map((result) => ({ id: String(result.id), score: result.score }));
  }

  private toChunks(ids: readonly string[]): Chunk[] {
    const out: Chunk[] = [];
    for (const id of ids) {
      const chunk = this.chunks.get(id);
      if (chunk) out.push(chunk);
    }
    return out;
  }
}

/** 按扩展名（不含点、小写）选择归一化器。 */
function pickNormalizer(
  normalizers: readonly DocumentNormalizer[],
  path: string,
): DocumentNormalizer | undefined {
  const ext = extname(path).slice(1).toLowerCase();
  return normalizers.find((normalizer) =>
    (normalizer.extensions as readonly string[]).includes(ext),
  );
}

/** 枚举文件：文件原样返回；目录递归列出全部文件。 */
async function listFiles(sources: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  for (const source of sources) {
    const info = await stat(source);
    if (info.isDirectory()) {
      const entries = await readdir(source, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) files.push(join(entry.parentPath, entry.name));
      }
    } else {
      files.push(source);
    }
  }
  return files;
}

/** 装载文档：枚举 sources → 按扩展名归一化 → 分块 → 索引。 */
export async function loadDocuments(
  config: DocumentsConfig,
  embedding?: EmbeddingProvider,
): Promise<DocumentIndex> {
  const index = new DocumentIndex({ topK: config.topK, embedding });
  const normalizers: DocumentNormalizer[] = [
    new TextNormalizer(),
    new HtmlNormalizer(),
    new PdfNormalizer(),
    new DocxNormalizer(),
    new EpubNormalizer(),
  ];
  const chunker: Chunker =
    config.chunking.strategy === 'heading'
      ? new MarkdownHeadingChunker({
          size: config.chunking.size,
          overlap: config.chunking.overlap,
        })
      : new FixedSizeChunker({ size: config.chunking.size, overlap: config.chunking.overlap });

  for (const file of await listFiles(config.sources)) {
    const normalizer = pickNormalizer(normalizers, file);
    if (!normalizer) continue;
    const content = await readFile(file);
    const doc = await normalizer.normalize({ path: file, content });
    await index.addChunks(
      chunker.chunk(doc.markdown).map((chunk) => ({
        text: chunk.text,
        metadata: { ...chunk.metadata, path: file },
      })),
    );
  }
  return index;
}
