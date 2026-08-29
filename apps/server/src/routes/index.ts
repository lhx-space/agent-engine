import { Hono } from 'hono';
import type { AppContext } from '../context';
import { agentRouter } from './agent';
import { healthRouter } from './health';
import { skillsRouter } from './skills';

/** 聚合全部资源路由。 */
export function createRouter(ctx: AppContext): Hono {
  const router = new Hono();

  router.route('/', healthRouter());
  router.route('/api/agent', agentRouter(ctx));
  router.route('/api/skills', skillsRouter(ctx));

  return router;
}
