import type { EmbeddingProvider } from '@agent-engine/core/embedding';
import type { LongTermMemory, MemoryBackend } from '@agent-engine/core/memory';
import type { VectorStore } from '@agent-engine/core/retrieval';

/**
 * 开发默认长期语义记忆：`EmbeddingProvider` 向量化 + `VectorStore.query` 召回 + `MemoryBackend` 持久化。
 * 无 `EmbeddingProvider` 时优雅 no-op（`remember` 不写、`recall` 返回空）。
 */
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

/** 创建长期语义记忆（组合 vectorStore + embedding + backend）。 */
export function createSemanticMemory(
  vectorStore: VectorStore,
  embedding: EmbeddingProvider | undefined,
  backend: MemoryBackend,
): LongTermMemory {
  return new SemanticMemory(vectorStore, embedding, backend);
}
