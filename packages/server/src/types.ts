import type { PluginFactory, ProviderFactory } from '@agent-engine/core';
import type { Logger } from './logger';
import type { SessionStoreBackend } from './session-store';
import type { SkillDiscoverer } from './services/skill-discovery';

/** `createApp` / `serve` 的可注入选项。 */
export interface ServerOptions {
  /** plugin 名 → 工厂（`@agent-engine/plugin-git` → `() => createGitPlugin()`）。 */
  pluginFactories?: Record<string, PluginFactory>;
  /** LLM provider 工厂；缺省用 core 的 `createProvider`。 */
  providerFactory?: ProviderFactory;
  /** 会话存储后端；缺省新建 in-memory `InMemorySessionStore`。 */
  sessionStore?: SessionStoreBackend;
  /** 日志后端；缺省 `consoleLogger`（pino / winston / OTel 经此注入）。 */
  logger?: Logger;
  /** skill 发现能力（对接 skills.sh）；缺省 `createNpxSkillDiscoverer()`。 */
  skillDiscoverer?: SkillDiscoverer;
}
