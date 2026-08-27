/**
 * @agent-engine/server —— HTTP 服务。
 * 对外提供 REST API（`/api/agent/run`），供 apps/web 与外部系统调用。
 */
export { createApp } from './app';
export { serve } from './serve';
export { envProviderFactory, resolveEnvApiKey } from './provider';
export { consoleLogger } from './logger';
export type { Logger } from './logger';
export { InMemorySessionStore } from './session-store';
export type { SessionStoreBackend, StoredSession, SessionStoreOptions } from './session-store';
export { createNpxSkillDiscoverer, parseSkillList, stripAnsi } from './services/skill-discovery';
export type {
  DiscoveredSkill,
  SkillDiscoverer,
  SkillDiscovererDeps,
} from './services/skill-discovery';
export type { ServerOptions } from './types';
