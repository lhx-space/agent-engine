import { randomUUID } from 'node:crypto';
import type { AgentConfig } from '@lhx-agent-engine/config';
import { AgentConfigSchema, deepFreeze, sanitizeConfigValue } from '@lhx-agent-engine/config';
import { resolveAgentConfig } from '@lhx-agent-engine/core';
import type { AgentLoop } from '@lhx-agent-engine/core';
import {
  createPresetLongTermMemoryFactory,
  createPresetPluginFactories,
  defaultCapabilityPlugins,
} from '@lhx-agent-engine/preset-default';
import { envProviderFactory } from '../infra/provider';
import type { SessionStoreBackend } from '../infra/session-store';
import type { ServerOptions } from '../types';

/** 一次 run 的已解析请求。 */
export interface RunRequest {
  config: AgentConfig;
  input: string;
  sessionId?: string;
}

export type ParseResult = { ok: true; value: RunRequest } | { ok: false; error: string };

/** Agent 会话装配/解析服务（handler 只调它，不碰 resolve 细节）。 */
export interface AgentService {
  /** 解析请求体 + 安全防线（sanitize → Zod 校验 → deepFreeze）。 */
  parseRunRequest(body: unknown): ParseResult;
  /** 按 sessionId 复用已装配 Agent，否则新建会话写入 store。 */
  getOrCreateSession(
    config: AgentConfig,
    sessionId: string | undefined,
  ): Promise<{ id: string; agent: AgentLoop }>;
  /** 结束并释放会话。 */
  deleteSession(id: string): Promise<void>;
}

/** 构造 AgentService（闭包 store 与装配选项）。 */
export function createAgentService(
  options: ServerOptions,
  store: SessionStoreBackend,
): AgentService {
  function parseRunRequest(body: unknown): ParseResult {
    const {
      config: rawConfig,
      input,
      sessionId,
    } = (body ?? {}) as {
      config?: unknown;
      input?: unknown;
      sessionId?: unknown;
    };

    const parsed = AgentConfigSchema.safeParse(sanitizeConfigValue(rawConfig));
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }
    return {
      ok: true,
      value: {
        config: deepFreeze(parsed.data),
        input: typeof input === 'string' ? input : '',
        sessionId: typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined,
      },
    };
  }

  async function getOrCreateSession(
    config: AgentConfig,
    sessionId: string | undefined,
  ): Promise<{ id: string; agent: AgentLoop }> {
    if (sessionId) {
      const existing = await store.get(sessionId);
      if (existing) return { id: sessionId, agent: existing.agent };
    }

    const id = randomUUID();
    const resolved = await resolveAgentConfig(config, {
      pluginFactories: {
        ...createPresetPluginFactories(config),
        ...options.pluginFactories,
      },
      defaultPlugins: defaultCapabilityPlugins(config),
      longTermMemoryFactory: createPresetLongTermMemoryFactory(),
      providerFactory: options.providerFactory ?? envProviderFactory,
    });
    await store.set(id, {
      agent: resolved.agent,
      dispose: resolved.dispose,
      lastActive: Date.now(),
    });
    return { id, agent: resolved.agent };
  }

  return {
    parseRunRequest,
    getOrCreateSession,
    deleteSession: (id) => store.delete(id),
  };
}
