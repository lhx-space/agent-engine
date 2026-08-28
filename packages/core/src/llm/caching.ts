import { createHash } from 'node:crypto';
import type { CacheBackend } from '../cache/cache-backend';
import type { ChatCompletionParams, ChatCompletionResult, DeltaKind, LLMProvider } from './types';

/** LLM 响应缓存：同一请求（messages + 关键参数）命中缓存直接返回，未命中则调用后写入。 */
export function createCachingProvider(
  provider: LLMProvider,
  cache: CacheBackend,
  options: { ttlMs?: number; prefix?: string } = {},
): LLMProvider {
  const prefix = options.prefix ?? 'llm:';
  const ttlMs = options.ttlMs ?? 300_000; // 默认 5 分钟

  function cacheKey(params: ChatCompletionParams): string {
    const payload = JSON.stringify({
      messages: params.messages,
      tools: params.tools,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      topP: params.topP,
      toolChoice: params.toolChoice,
      responseFormat: params.responseFormat,
    });
    return prefix + createHash('sha1').update(payload).digest('hex').slice(0, 24);
  }

  async function complete(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const key = cacheKey(params);
    const hit = await cache.get(key);
    if (hit !== undefined) {
      return hit as ChatCompletionResult;
    }
    const result = await provider.chatCompletion(params);
    await cache.set(key, result, ttlMs);
    return result;
  }

  return {
    name: provider.name,
    chatCompletion: complete,
    async chatCompletionStream(
      params: ChatCompletionParams,
      onDelta: (delta: string, kind?: DeltaKind) => void,
    ): Promise<ChatCompletionResult> {
      // 流式实时性优先，不缓存增量；无流式实现时退回非流式（走缓存）。
      if (provider.chatCompletionStream) {
        return provider.chatCompletionStream(params, onDelta);
      }
      return complete(params);
    },
  };
}
