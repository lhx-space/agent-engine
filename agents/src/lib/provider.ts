import { createProvider } from '@agent-engine/core';
import type { ProviderFactory } from '@agent-engine/core';

/**
 * 运行时环境密钥 → config.apiKey 的映射（宿主职责，内核不读 process.env）。
 * config 里显式 apiKey 优先，否则 DEEPSEEK_API_KEY / OPENAI_API_KEY 兜底。
 */
export const providerFactory: ProviderFactory = (config) => {
  const apiKey = config.apiKey ?? process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;
  return createProvider({ ...config, apiKey });
};
