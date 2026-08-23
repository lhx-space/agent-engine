import type { ModelConfig } from '@agent-engine/config';
import { createAnthropicProvider } from './anthropic.js';
import { createOpenAIProvider } from './openai.js';
import type { LLMProvider } from './types.js';

export type ProviderFactory = (config: ModelConfig) => LLMProvider;

const factories: Record<ModelConfig['provider'], ProviderFactory> = {
  'openai-compatible': createOpenAIProvider,
  anthropic: createAnthropicProvider,
  // custom 协议假设 OpenAI 兼容（DeepSeek / Ollama / vLLM 均如此），但 baseURL 需显式提供。
  custom: createOpenAIProvider,
};

export function createProvider(config: ModelConfig): LLMProvider {
  const factory = factories[config.provider];
  return factory(config);
}
