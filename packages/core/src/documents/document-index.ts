import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { DocumentsConfig } from '@agent-engine/config';
import MiniSearch from 'minisearch';
import { segment } from '../retrieval/registry';
import { FixedSizeChunker, MarkdownHeadingChunker } from './chunker';
import { HtmlNormalizer } from './html-normalizer';
import { TextNormalizer } from './text-normalizer';
import type { Chunk, Chunker, DocumentNormalizer } from './types';

/** 文档检索索引：MiniSearch 索引 chunk 文本，按 query 词法（BM25）召回 top-k。 */
export class DocumentIndex {
  private readonly chunks = new Map<string, Chunk>();
  private readonly index: MiniSearch;
  private nextId = 0;

  constructor(private readonly topK = 4) {
    this.index = new MiniSearch({
      fields: ['text'],
      tokenize: (text) => segment(text),
    });
  }

  /** 追加 chunk。 */
  addChunks(chunks: Chunk[]): void {
    for (const chunk of chunks) {
      const id = `chunk-${this.nextId}`;
      this.nextId += 1;
      this.chunks.set(id, chunk);
      this.index.add({ id, text: chunk.text });
    }
  }

  /** 词法（BM25）召回 top-k chunk。 */
  retrieve(query: string, topK = this.topK): Chunk[] {
    const results = this.index.search(query);
    const out: Chunk[] = [];
    for (const result of results.slice(0, topK)) {
      const chunk = this.chunks.get(String(result.id));
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
export async function loadDocuments(config: DocumentsConfig): Promise<DocumentIndex> {
  const index = new DocumentIndex(config.topK);
  const normalizers: DocumentNormalizer[] = [new TextNormalizer(), new HtmlNormalizer()];
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
    index.addChunks(
      chunker.chunk(doc.markdown).map((chunk) => ({
        text: chunk.text,
        metadata: { ...chunk.metadata, path: file },
      })),
    );
  }
  return index;
}
