import type { PluginFactory, ProviderFactory } from '@agent-engine/core';

/** `createApp` / `serve` 的可注入选项。 */
export interface ServerOptions {
  /** plugin 名 → 工厂（`@agent-engine/plugin-git` → `() => createGitPlugin()`）。 */
  pluginFactories?: Record<string, PluginFactory>;
  /** LLM provider 工厂；缺省用 core 的 `createProvider`。 */
  providerFactory?: ProviderFactory;
}
