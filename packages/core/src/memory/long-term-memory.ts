import type { EmbeddingProvider } from '../embedding/embedding';
import type { VectorStore } from '../retrieval/vector-store';
import type { MemoryBackend } from './memory-backend';

/**
 * 长期记忆抽象（三层记忆③）：跨会话把文本向量化写入向量库并持久化，按 query 语义召回。
 * 无 `EmbeddingProvider` 时优雅 no-op（不抛错）——语义记忆是「有 embedding 才启用」的可选能力。
 */
export interface LongTermMemory {
  readonly name: string;
  remember(text: string): Promise<void>;
  recall(query: string, topK?: number): Promise<string[]>;
}

/** 开发默认：`EmbeddingProvider` 向量化 + `VectorStore.query` 召回 + `MemoryBackend` 持久化。 */
export class SemanticMemory implements LongTermMemory {
  readonly name = 'semantic';
  private counter = 0;

  constructor(
    private readonly vectorStore: VectorStore,
    private readonly embedding: EmbeddingProvider | undefined,
    private readonly backend: MemoryBackend,
  ) {}

  async remember(text: string): Promise<void> {
    if (!this.embedding || !text) return;
    const [vector] = await this.embedding.embed([text]);
    if (!vector) return;
    const id = `mem-${Date.now()}-${this.counter++}`;
    await this.vectorStore.add([{ id, vector, metadata: { text } }]);
    await this.backend.set(id, { text });
  }

  async recall(query: string, topK = 3): Promise<string[]> {
    if (!this.embedding) return [];
    const [vector] = await this.embedding.embed([query]);
    if (!vector) return [];
    const matches = await this.vectorStore.query(vector, topK);
    return matches
      .map((match) => match.metadata?.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0);
  }
}
