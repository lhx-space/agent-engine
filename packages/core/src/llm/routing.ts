import { ApproximateTokenCounter } from '../context/token-counter';
import type { ChatCompletionParams, ChatCompletionResult, DeltaKind, LLMProvider } from './types';

/** 模型路由：根据输入复杂度 / 能力标签选择目标模型。 */
export interface ModelRoute {
  name: string;
  provider: LLMProvider;
  when?: {
    /** 输入 token 达到该阈值 → 命中（复杂度路由）。 */
    minInputTokens?: number;
    /** 请求声明的能力标签命中任一 → 命中（能力路由）。 */
    capabilities?: string[];
  };
}

/** 估算输入消息的 token 数（粗估：全部 content 长度 / 4，复用默认 token 计数策略）。 */
function estimateInputTokens(params: ChatCompletionParams): number {
  const counter = new ApproximateTokenCounter();
  let total = 0;
  for (const message of params.messages) {
    total += counter.count(message.content);
  }
  return total;
}

/**
 * 路由 provider：每次调用前评估 routes，命中则用对应 provider，否则用默认。
 * 路由在最外层；默认 provider 通常已是 resilient（重试 + fallback），route provider 各自独立。
 */
export function createRoutingProvider(
  defaultProvider: LLMProvider,
  routes: ModelRoute[],
): LLMProvider {
  function resolveProvider(params: ChatCompletionParams): LLMProvider {
    const inputTokens = estimateInputTokens(params);
    for (const route of routes) {
      const when = route.when;
      if (!when) continue;
      if (when.minInputTokens !== undefined && inputTokens >= when.minInputTokens) {
        return route.provider;
      }
      if (
        when.capabilities &&
        params.capabilities?.some((capability) => when.capabilities!.includes(capability))
      ) {
        return route.provider;
      }
    }
    return defaultProvider;
  }

  return {
    name: `router:${[defaultProvider.name, ...routes.map((route) => route.name)].join('|')}`,
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      return resolveProvider(params).chatCompletion(params);
    },
    async chatCompletionStream(
      params: ChatCompletionParams,
      onDelta: (delta: string, kind?: DeltaKind) => void,
    ): Promise<ChatCompletionResult> {
      const provider = resolveProvider(params);
      if (provider.chatCompletionStream) {
        return provider.chatCompletionStream(params, onDelta);
      }
      return provider.chatCompletion(params);
    },
  };
}
