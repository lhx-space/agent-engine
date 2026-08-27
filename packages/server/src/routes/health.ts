import { Hono } from 'hono';

/** 健康检查路由。 */
export function healthRouter(): Hono {
  const router = new Hono();
  router.get('/health', (c) => c.json({ ok: true }));
  return router;
}
