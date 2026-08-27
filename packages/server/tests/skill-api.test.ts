import { describe, expect, it } from '@rstest/core';
import { createApp } from '../src/app';
import type { SkillDiscoverer } from '../src/services/skill-discovery';

function makeDiscoverer(overrides: Partial<SkillDiscoverer> = {}): SkillDiscoverer {
  return {
    discover: async () => [{ name: 'a', description: 'b' }],
    listInstalled: async () => ['a'],
    install: async () => ({ path: '/tmp/skills/a' }),
    ...overrides,
  };
}

describe('skill-api', () => {
  it('GET /api/skills/discover 返回 skill 列表', async () => {
    const app = createApp({ skillDiscoverer: makeDiscoverer() });
    const res = await app.request('/api/skills/discover?repo=vercel-labs/agent-skills');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      repo: 'vercel-labs/agent-skills',
      skills: [{ name: 'a', description: 'b' }],
    });
  });

  it('GET /api/skills/discover 缺 repo 返回 400', async () => {
    const app = createApp({ skillDiscoverer: makeDiscoverer() });
    const res = await app.request('/api/skills/discover');

    expect(res.status).toBe(400);
  });

  it('GET /api/skills 返回已装列表', async () => {
    const app = createApp({ skillDiscoverer: makeDiscoverer() });
    const res = await app.request('/api/skills');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ skills: ['a'] });
  });

  it('POST /api/skills/install 返回路径', async () => {
    const app = createApp({ skillDiscoverer: makeDiscoverer() });
    const res = await app.request('/api/skills/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: 'vercel-labs/agent-skills', skill: 'a' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ path: '/tmp/skills/a' });
  });

  it('POST /api/skills/install 缺字段返回 400', async () => {
    const app = createApp({ skillDiscoverer: makeDiscoverer() });
    const res = await app.request('/api/skills/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: 'x' }),
    });

    expect(res.status).toBe(400);
  });
});
