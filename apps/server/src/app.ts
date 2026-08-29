import { Hono } from 'hono';
import { createAppContext } from './context';
import { createErrorHandler } from './middlewares/error';
import { createRouter } from './routes/index';
import type { ServerOptions } from './types';

/**
 * 创建 HTTP 应用：装配依赖（`AppContext`）→ 挂载路由 → 注册全局错误处理。
 *
 * 端点：
 * - `GET /health`
 * - `POST /api/agent/run`（非流式）、`POST /api/agent/run/stream`（NDJSON）、`DELETE /api/agent/sessions/:id`
 * - `GET /api/skills/discover`、`GET /api/skills`、`POST /api/skills/install`（find-skill，对接 skills.sh）
 */
export function createApp(options: ServerOptions = {}): Hono {
  const app = new Hono();
  const ctx = createAppContext(options);

  app.route('/', createRouter(ctx));
  app.onError(createErrorHandler(ctx.logger));

  return app;
}
