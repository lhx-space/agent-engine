import { Hono } from 'hono';
import type { AppContext } from '../context';
import { createSkillHandlers } from '../handlers/skills';

/** skill 发现路由（挂载于 `/api/skills`），只做「路径 → handler」映射。 */
export function skillsRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const handlers = createSkillHandlers(ctx.skillDiscoverer);

  router.get('/discover', handlers.discover);
  router.get('/', handlers.listInstalled);
  router.post('/install', handlers.install);

  return router;
}
