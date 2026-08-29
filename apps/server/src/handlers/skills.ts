import type { Context } from 'hono';
import { HttpError } from '../middlewares/error';
import type { SkillDiscoverer } from '../services/skill-discovery';
import { readJson } from './http';

/** skill 发现 handler（对接 skills.sh）。 */
export interface SkillHandlers {
  discover(c: Context): Promise<Response>;
  listInstalled(c: Context): Promise<Response>;
  install(c: Context): Promise<Response>;
}

export function createSkillHandlers(discoverer: SkillDiscoverer): SkillHandlers {
  function wrap(action: string, error: unknown): HttpError {
    return new HttpError(
      500,
      `skill ${action} failed`,
      error instanceof Error ? error.message : String(error),
    );
  }

  return {
    async discover(c) {
      const repo = c.req.query('repo');
      if (!repo) throw new HttpError(400, 'missing query "repo" (owner/repo)');
      try {
        const skills = await discoverer.discover(repo);
        return c.json({ repo, skills });
      } catch (error) {
        throw wrap('discover', error);
      }
    },

    async listInstalled(c) {
      try {
        const skills = await discoverer.listInstalled();
        return c.json({ skills });
      } catch (error) {
        throw wrap('list', error);
      }
    },

    async install(c) {
      const body = await readJson(c);
      const { repo, skill } = (body ?? {}) as { repo?: unknown; skill?: unknown };
      if (
        typeof repo !== 'string' ||
        repo.length === 0 ||
        typeof skill !== 'string' ||
        skill.length === 0
      ) {
        throw new HttpError(400, '"repo" and "skill" are required');
      }
      try {
        return c.json(await discoverer.install(repo, skill));
      } catch (error) {
        throw wrap('install', error);
      }
    },
  };
}
