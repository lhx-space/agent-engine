import { Hono } from 'hono';
import type { AppContext } from '../context';
import { createAgentHandlers } from '../handlers/agent';

/** Agent 运行/会话路由（挂载于 `/api/agent`），只做「路径 → handler」映射。 */
export function agentRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const handlers = createAgentHandlers(ctx.agentService, ctx.logger);

  router.post('/run', handlers.run);
  router.post('/run/stream', handlers.runStream);
  router.delete('/sessions/:id', handlers.deleteSession);

  return router;
}
