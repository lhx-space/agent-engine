/**
 * @agent-engine/server —— HTTP 服务。
 * 对外提供 REST API（`/api/agent/run`），供 apps/web 与外部系统调用。
 */
export { createApp } from './app';
export { serve } from './serve';
export { envProviderFactory, resolveEnvApiKey } from './infra/provider';
export { consoleLogger } from './infra/logger';
export type { Logger } from './infra/logger';
export { InMemorySessionStore } from './infra/session-store';
export type {
  SessionStoreBackend,
  StoredSession,
  SessionStoreOptions,
} from './infra/session-store';
export { createNpxSkillDiscoverer } from './services/skill-discovery';
export type {
  DiscoveredSkill,
  SkillDiscoverer,
  SkillDiscovererDeps,
} from './services/skill-discovery';
export { parseInstalledSkills, parseSkillList, stripAnsi } from './utils/skill-list';
export type { ParsedSkill } from './utils/skill-list';
export type { ServerOptions } from './types';
