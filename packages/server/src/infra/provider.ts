import { createProvider } from '@agent-engine/core';
import type { ProviderFactory } from '@agent-engine/core';
import type { BaseModelConfig } from '@agent-engine/config';

/**
 * 运行时环境密钥 → config.apiKey 的映射（部署层职责，内核不读 process.env）。
 * provider 为 openai-compatible / custom 时取 DEEPSEEK_API_KEY，其次 OPENAI_API_KEY；
 * anthropic 取 ANTHROPIC_API_KEY。
 */
export function resolveEnvApiKey(provider: BaseModelConfig['provider']): string | undefined {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'openai-compatible':
    case 'custom':
      return process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;
  }
}

/**
 * 环境变量兜底的 provider 工厂：config 里显式给了 apiKey 就优先用它，
 * 否则用环境变量兜底，再交给 core 的 createProvider 构造。
 */
export const envProviderFactory: ProviderFactory = (config: BaseModelConfig) => {
  const apiKey = config.apiKey ?? resolveEnvApiKey(config.provider);
  return createProvider({ ...config, apiKey });
};
