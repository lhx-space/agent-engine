import type { AgentConfig } from '@lhx-agent-engine/config/schema';

export interface EnvHint {
  name: string;
  reason: string;
}

const ENV_TOKEN = /\$\{([A-Z0-9_]+)\}/;

/** 根据当前配置推导「服务端需要哪些环境变量」，用于前端友好提示。 */
export function requiredEnv(config: AgentConfig): EnvHint[] {
  const hints: EnvHint[] = [];

  // 已在配置里显式提供 apiKey，则无需环境变量兜底。
  if (!config.model.apiKey) {
    switch (config.model.provider) {
      case 'anthropic':
        hints.push({ name: 'ANTHROPIC_API_KEY', reason: 'Anthropic 模型调用凭证' });
        break;
      case 'openai-compatible':
      case 'custom':
        hints.push({ name: 'DEEPSEEK_API_KEY', reason: '默认 DeepSeek（OpenAI 兼容）凭证' });
        hints.push({ name: 'OPENAI_API_KEY', reason: '或使用 OpenAI 凭证（二选一）' });
        break;
    }
  }

  for (const server of config.mcp?.servers ?? []) {
    for (const value of Object.values(server.env ?? {})) {
      const match = ENV_TOKEN.exec(value);
      const token = match?.[1];
      if (token) {
        hints.push({ name: token, reason: `MCP server "${server.name}" 引用` });
      }
    }
  }

  return hints;
}
