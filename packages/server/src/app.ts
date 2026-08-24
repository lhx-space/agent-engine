import { AgentConfigSchema, deepFreeze, sanitizeConfigValue } from '@agent-engine/config';
import { resolveAgentConfig } from '@agent-engine/core';
import { Hono } from 'hono';
import { envProviderFactory } from './provider';
import type { ServerOptions } from './types';

/** 创建 HTTP 应用：`GET /health` + `POST /api/agent/run`。 */
export function createApp(options: ServerOptions = {}): Hono {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/api/agent/run', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }

    const { config: rawConfig, input } = (body ?? {}) as {
      config?: unknown;
      input?: unknown;
    };

    // 与 loadAgentConfig 同一套安全防线：sanitize → Zod 校验 → deepFreeze。
    const parsed = AgentConfigSchema.safeParse(sanitizeConfigValue(rawConfig));
    if (!parsed.success) {
      return c.json({ error: 'invalid config', details: parsed.error.message }, 400);
    }
    const config = deepFreeze(parsed.data);
    const userInput = typeof input === 'string' ? input : '';

    try {
      const resolved = await resolveAgentConfig(config, {
        pluginFactories: options.pluginFactories,
        providerFactory: options.providerFactory ?? envProviderFactory,
      });
      try {
        const result = await resolved.agent.run(userInput);
        return c.json(result);
      } finally {
        await resolved.dispose();
      }
    } catch (error) {
      return c.json(
        {
          error: 'agent execution failed',
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  });

  return app;
}
