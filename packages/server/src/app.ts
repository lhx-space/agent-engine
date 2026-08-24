import { AgentConfigSchema, deepFreeze, sanitizeConfigValue } from '@agent-engine/config';
import { resolveAgentConfig } from '@agent-engine/core';
import type { AgentConfig } from '@agent-engine/config';
import { Hono } from 'hono';
import { logger } from './logger';
import { envProviderFactory } from './provider';
import type { ServerOptions } from './types';

interface ParsedRequest {
  config: AgentConfig;
  input: string;
}

/** 解析请求体 + 安全防线（sanitize → Zod 校验 → deepFreeze）。失败返回 null + 错误响应。 */
function parseRunRequest(
  body: unknown,
): { ok: true; value: ParsedRequest } | { ok: false; error: string } {
  const { config: rawConfig, input } = (body ?? {}) as {
    config?: unknown;
    input?: unknown;
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
    },
  };
}

/** 创建 HTTP 应用：`GET /health` + `POST /api/agent/run`（非流式）+ `POST /api/agent/run/stream`（NDJSON）。 */
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

    const req = parseRunRequest(body);
    if (!req.ok) {
      return c.json({ error: 'invalid config', details: req.error }, 400);
    }

    try {
      const resolved = await resolveAgentConfig(req.value.config, {
        pluginFactories: options.pluginFactories,
        providerFactory: options.providerFactory ?? envProviderFactory,
      });
      try {
        const result = await resolved.agent.run(req.value.input);
        return c.json(result);
      } finally {
        await resolved.dispose();
      }
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

    let resolved;
    try {
      resolved = await resolveAgentConfig(req.value.config, {
        pluginFactories: options.pluginFactories,
        providerFactory: options.providerFactory ?? envProviderFactory,
      });
    } catch (error) {
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
          await resolved.agent.run(req.value.input, {
            onEvent: (event) => {
              write(event);
              logger.info({ event: event.type }, 'agent stream event');
            },
          });
          // run 内部已发 done / error 事件。
        } catch (error) {
          // run 内部已 emit error 事件；这里只记日志，不重复写 error。
          logger.error({ err: error }, 'agent stream failed');
        } finally {
          await resolved.dispose();
          controller.close();
        }
      },
    });

    return c.body(stream, 200, {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache',
    });
  });

  return app;
}
