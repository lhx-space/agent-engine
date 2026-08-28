import type { EmbeddingConfig } from '@lhx-agent-engine/config';
import { defaultFetch } from '../tools/utils/http';
import type { FetchLike } from '../tools/utils/http';
import type { EmbeddingProvider } from './embedding';

interface EmbeddingsResponse {
  data: { embedding: number[] }[];
}

/**
 * 创建 openai-compatible embedding provider：POST `{baseURL}/embeddings`（`{ model, input }`）。
 * 覆盖 OpenAI / DeepSeek / ollama 等兼容端点；非兼容端点请自定义实现 `EmbeddingProvider` 并经插件注入。
 */
export function createEmbeddingProvider(
  config: EmbeddingConfig,
  fetchImpl: FetchLike = defaultFetch,
): EmbeddingProvider {
  const baseURL = (config.baseURL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  let dimension = config.dimension;

  return {
    name: `openai-compatible:${config.model}`,
    get dimension(): number {
      if (dimension === undefined) {
        throw new Error(
          'Embedding dimension unknown: declare `embedding.dimension` or call embed() once first',
        );
      }
      return dimension;
    },
    async embed(texts) {
      const response = await fetchImpl(`${baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: config.model, input: texts }),
      });
      if (!response.ok) {
        throw new Error(`Embedding request failed: HTTP ${response.status}`);
      }
      const payload = (await response.json()) as EmbeddingsResponse;
      const vectors = (payload.data ?? []).map((item) => item.embedding);
      if (dimension === undefined && vectors[0]) {
        dimension = vectors[0].length;
      }
      return vectors;
    },
  };
}
