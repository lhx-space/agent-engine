import type { AgentLoop } from '@agent-engine/core';
import type { Context } from 'hono';
import type { Logger } from '../logger';
import { HttpError } from '../middlewares/error';
import type { AgentService } from '../services/agent';
import { readJson } from './http';

/** Agent 运行/会话 handler（解析请求 → 调 service → 格式化响应；错误抛 `HttpError`）。 */
export interface AgentHandlers {
  run(c: Context): Promise<Response>;
  runStream(c: Context): Promise<Response>;
  deleteSession(c: Context): Promise<Response>;
}

export function createAgentHandlers(service: AgentService, logger: Logger): AgentHandlers {
  /** 解析请求体 → 校验 config → 装配会话；非法 config 抛 400，装配失败包装为 500。 */
  async function resolveSession(
    c: Context,
  ): Promise<{ id: string; agent: AgentLoop; input: string }> {
    const body = await readJson(c);
    const req = service.parseRunRequest(body);
    if (!req.ok) throw new HttpError(400, 'invalid config', req.error);

    try {
      const session = await service.getOrCreateSession(req.value.config, req.value.sessionId);
      return { ...session, input: req.value.input };
    } catch (error) {
      throw new HttpError(
        500,
        'agent execution failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return {
    async run(c) {
      const session = await resolveSession(c);
      try {
        const result = await session.agent.run(session.input);
        return c.json({ sessionId: session.id, ...result });
      } catch (error) {
        throw new HttpError(
          500,
          'agent execution failed',
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    async runStream(c) {
      const session = await resolveSession(c);

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const write = (event: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };
          try {
            await session.agent.run(session.input, {
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
    },

    async deleteSession(c) {
      await service.deleteSession(c.req.param('id')!);
      return c.json({ ok: true });
    },
  };
}
