import type { ChatCompletionParams, ChatCompletionResult, DeltaKind, LLMProvider } from './types';
import { AbortError } from './types';

/** LLM 调用重试配置（对齐 `execution.toolRetry`）。 */
export interface LLMRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
}

/**
 * 判断错误是否可重试：
 * - 429（限流）/ 5xx（服务端错误）→ 可重试；
 * - 其它 4xx（请求本身有问题）→ 不可重试；
 * - 无 `status`（网络/超时/未知）→ 可重试。
 * 取消（AbortError）永不重试。
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AbortError) return false;
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number') {
    return status === 429 || status >= 500;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 容错 provider：主模型失败后按指数退避重试，仍失败则依次 fallback 到备用模型。
 * 每个 provider 独立重试 `maxRetries` 次（仅可重试错误）；全部失败抛最后一个错误。
 * 流式失败同样走重试/fallback（从头重试，可能重复已发 delta，由上层容忍）。
 */
export function createResilientProvider(
  providers: LLMProvider[],
  retry: LLMRetryConfig = { maxRetries: 2, baseDelayMs: 500 },
): LLMProvider {
  const maxRetries = Math.max(0, Math.floor(retry.maxRetries));
  const baseDelayMs = Math.max(0, retry.baseDelayMs);

  async function run<T>(fn: (provider: LLMProvider) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const provider of providers) {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          return await fn(provider);
        } catch (error) {
          lastError = error;
          if (!isRetryableError(error) || attempt >= maxRetries) {
            break; // 放弃当前 provider，试下一个
          }
          await sleep(baseDelayMs * 2 ** attempt);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  return {
    name: providers.map((provider) => provider.name).join('|'),
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      return run((provider) => provider.chatCompletion(params));
    },
    async chatCompletionStream(
      params: ChatCompletionParams,
      onDelta: (delta: string, kind?: DeltaKind) => void,
    ): Promise<ChatCompletionResult> {
      return run((provider) => {
        if (!provider.chatCompletionStream) {
          return provider.chatCompletion(params);
        }
        return provider.chatCompletionStream(params, onDelta);
      });
    },
  };
}
