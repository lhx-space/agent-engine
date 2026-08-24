import type { AgentConfig } from '@agent-engine/config';
import { assembleAgentLoop } from '../agent/assemble';
import { resolveMcpServers } from '../capability-source/mcp';
import { resolveSkills } from '../capability-source/skill';
import { HookPipeline } from '../hooks/pipeline';
import { createProvider } from '../llm/provider';
import { ConversationMemory } from '../memory/conversation-memory';
import type { Plugin } from '../plugins/types';
import { ToolRegistry } from '../tools/registry';
import type { ResolveDeps, ResolvedAgent } from './types';

/**
 * 把一份 `AgentConfig` 一键装配成可运行的 Agent（「配置即 Agent」的闭合点）。
 *
 * 装配顺序：provider（可注入 factory）→ 按名实例化 plugins → 按路径加载 skills →
 * 建 registry / hooks / memory → 交给 `assembleAgentLoop` 合并 bundles 并构造 AgentLoop。
 */
export async function resolveAgentConfig(
  config: AgentConfig,
  deps: ResolveDeps = {},
): Promise<ResolvedAgent> {
  const provider = (deps.providerFactory ?? createProvider)(config.model);
  const registry = new ToolRegistry();
  const hooks = new HookPipeline();

  // plugins：字符串名 → 工厂实例化（core 不反向依赖各 plugin 包）。
  const plugins: Plugin[] = [];
  for (const name of config.plugins) {
    const factory = deps.pluginFactories?.[name];
    if (!factory) {
      throw new Error(
        `未注册的 plugin "${name}"：请在 resolveAgentConfig 的 deps.pluginFactories 提供其工厂`,
      );
    }
    plugins.push(await factory());
  }

  // skills：按来源（path / npm / git）解析加载，并聚合临时资源清理。
  const { skills, dispose: disposeSkills } = await resolveSkills(config.skills);

  // memory：会话窗口（长期记忆 M3 后续）。
  const memory = config.memory?.session
    ? new ConversationMemory({ maxMessages: config.memory.session.maxMessages })
    : undefined;

  const resolved = await assembleAgentLoop({
    provider,
    registry,
    hooks,
    systemPrompt: config.systemPrompt,
    rules: config.rules,
    skills,
    plugins,
    memory,
    security: config.security,
    mcp: resolveMcpServers(config.mcp?.servers ?? []),
    sandbox: deps.sandbox,
  });

  const { dispose: disposeAgent } = resolved;
  return {
    agent: resolved.agent,
    dispose: async () => {
      await disposeAgent();
      await disposeSkills();
    },
  };
}
