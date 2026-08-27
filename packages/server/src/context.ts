import { consoleLogger } from './logger';
import type { Logger } from './logger';
import { createAgentService } from './services/agent';
import type { AgentService } from './services/agent';
import { createNpxSkillDiscoverer } from './services/skill-discovery';
import type { SkillDiscoverer } from './services/skill-discovery';
import { InMemorySessionStore } from './session-store';
import type { SessionStoreBackend } from './session-store';
import type { ServerOptions } from './types';

/** 装配后的依赖容器（各路由 handler 的入口）。 */
export interface AppContext {
  logger: Logger;
  store: SessionStoreBackend;
  skillDiscoverer: SkillDiscoverer;
  agentService: AgentService;
}

/** 按 options 装配默认依赖（store / logger / skillDiscoverer / agentService）。 */
export function createAppContext(options: ServerOptions): AppContext {
  const store = options.sessionStore ?? new InMemorySessionStore();
  return {
    logger: options.logger ?? consoleLogger,
    store,
    skillDiscoverer: options.skillDiscoverer ?? createNpxSkillDiscoverer(),
    agentService: createAgentService(options, store),
  };
}
