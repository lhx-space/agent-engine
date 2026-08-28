import type { BaseModelConfig } from '@lhx-agent-engine/config';
import { createAnthropicProvider } from './anthropic';
import { createOpenAIProvider } from './openai';
import type { LLMProvider } from './types';

export type ProviderFactory = (config: BaseModelConfig) => LLMProvider;

const factories: Record<BaseModelConfig['provider'], ProviderFactory> = {
  'openai-compatible': createOpenAIProvider,
  anthropic: createAnthropicProvider,
  // custom 协议假设 OpenAI 兼容（DeepSeek / Ollama / vLLM 均如此），但 baseURL 需显式提供。
  custom: createOpenAIProvider,
};

export function createProvider(config: BaseModelConfig): LLMProvider {
  const factory = factories[config.provider];
  return factory(config);
}
