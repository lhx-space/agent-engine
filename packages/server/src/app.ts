import { randomUUID } from 'node:crypto';
import { AgentConfigSchema, deepFreeze, sanitizeConfigValue } from '@agent-engine/config';
import { resolveAgentConfig } from '@agent-engine/core';
import type { AgentConfig } from '@agent-engine/config';
import type { AgentLoop } from '@agent-engine/core';
import { Hono } from 'hono';
import {
  createPresetLongTermMemoryFactory,
  createPresetPluginFactories,
  defaultCapabilityPlugins,
} from '@agent-engine/preset-default';
import { consoleLogger } from './logger';
import { envProviderFactory } from './provider';
import { InMemorySessionStore } from './session-store';
import type { SessionStoreBackend } from './session-store';
import type { ServerOptions } from './types';

interface ParsedRequest {
  config: AgentConfig;
  input: string;
  sessionId?: string;
}

/** 解析请求体 + 安全防线（sanitize → Zod 校验 → deepFreeze）。失败返回 null + 错误响应。 */
function parseRunRequest(
  body: unknown,
): { ok: true; value: ParsedRequest } | { ok: false; error: string } {
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

/** 按 sessionId 复用已装配 Agent，否则新建会话写入 store。 */
async function getOrCreateSession(
  config: AgentConfig,
  sessionId: string | undefined,
  store: SessionStoreBackend,
  options: ServerOptions,
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
  await store.set(id, { agent: resolved.agent, dispose: resolved.dispose, lastActive: Date.now() });
  return { id, agent: resolved.agent };
}

/** 创建 HTTP 应用：`GET /health` + `POST /api/agent/run`（非流式）+ `POST /api/agent/run/stream`（NDJSON）+ `DELETE /api/agent/sessions/:id`。 */
export function createApp(options: ServerOptions = {}): Hono {
  const app = new Hono();
  const store = options.sessionStore ?? new InMemorySessionStore();
  const logger = options.logger ?? consoleLogger;

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/api/agent/run', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }

    const req = parseRunRequest(body);
    if (!req.ok) {
      return c.json({ error: 'invalid config', details: req.error }, 400);
    }

    try {
      const session = await getOrCreateSession(
        req.value.config,
        req.value.sessionId,
        store,
        options,
      );
      const result = await session.agent.run(req.value.input);
      return c.json({ sessionId: session.id, ...result });
    } catch (error) {
      logger.error({ err: error }, 'agent run failed');
      return c.json(
        {
          error: 'agent execution failed',
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  });

  app.post('/api/agent/run/stream', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }

    const req = parseRunRequest(body);
    if (!req.ok) {
      return c.json({ error: 'invalid config', details: req.error }, 400);
    }

    let session;
    try {
      session = await getOrCreateSession(req.value.config, req.value.sessionId, store, options);
    } catch (error) {
      logger.error({ err: error }, 'agent session resolve failed');
      return c.json(
        {
          error: 'agent execution failed',
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const write = (event: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          await session.agent.run(req.value.input, {
            onEvent: (event) => {
              write(event);
              logger.info({ event: event.type }, 'agent stream event');
            },
          });
        } catch (error) {
          logger.error({ err: error }, 'agent stream failed');
        } finally {
          controller.close();
        }
      },
    });

    return c.body(stream, 200, {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache',
      'x-session-id': session.id,
    });
  });

  app.delete('/api/agent/sessions/:id', async (c) => {
    const id = c.req.param('id');
    await store.delete(id);
    return c.json({ ok: true });
  });

  return app;
}
