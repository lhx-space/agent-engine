import type { AgentConfig } from '@agent-engine/config';
import { assembleAgentLoop } from '../agent/assemble';
import { resolveMcpServers } from '../capability-source/mcp';
import { createEmbeddingProvider } from '../embedding/openai';
import { HookPipeline } from '../hooks/pipeline';
import { createProvider } from '../llm/provider';
import type { Plugin } from '../plugins/types';
import { ToolRegistry } from '../tools/registry';
import type { ResolveDeps, ResolvedAgent } from './types';

/**
 * 把一份 `AgentConfig` 一键装配成可运行的 Agent（「配置即 Agent」的闭合点）。
 *
 * 装配顺序：provider（可注入 factory）→ 按名实例化 plugins →
 * 建 registry / hooks / memory → 交给 `assembleAgentLoop` 合并 bundles 并构造 AgentLoop。
 * skills / documents 已外放为 `plugin-skills` / `plugin-documents`（其工厂闭包 config 切片自行装载）。
 */
export async function resolveAgentConfig(
  config: AgentConfig,
  deps: ResolveDeps = {},
): Promise<ResolvedAgent> {
  const provider = (deps.providerFactory ?? createProvider)(config.model);
  const registry = new ToolRegistry();
  const hooks = new HookPipeline();

  // plugins：字符串名 → 工厂实例化（core 不反向依赖各 plugin 包；内置 files/bash/git 由 server 层注入工厂）。
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

  // embedding：长期记忆语义召回共享同一 provider（插件注入的 provider 在 assemble 内解析，装载阶段不可见）。
  const embeddingProvider = config.embedding
    ? createEmbeddingProvider(config.embedding)
    : undefined;

  const resolved = await assembleAgentLoop({
    provider,
    registry,
    hooks,
    systemPrompt: config.systemPrompt,
    plugins,
    sessionMemory: config.memory?.session,
    security: config.security,
    tools: config.tools,
    execution: config.execution,
    mcp: resolveMcpServers(config.mcp?.servers ?? []),
    sandbox: deps.sandbox,
    longTermBackend: config.memory?.longTerm?.backend,
    cacheBackend: config.cache?.backend,
    embeddingProvider,
  });

  const { dispose: disposeAgent } = resolved;

  // onInit：装配完成后触发一次；失败则释放已装配资源后向上抛。
  try {
    await hooks.onInit();
  } catch (error) {
    await disposeAgent();
    throw error;
  }

  return {
    agent: resolved.agent,
    memoryBackend: resolved.memoryBackend,
    cacheBackend: resolved.cacheBackend,
    vectorStore: resolved.vectorStore,
    embeddingProvider: resolved.embeddingProvider,
    longTermMemory: resolved.longTermMemory,
    eventBus: resolved.eventBus,
    tokenCounter: resolved.tokenCounter,
    contextCompactor: resolved.contextCompactor,
    retriever: resolved.retriever,
    reranker: resolved.reranker,
    dispose: async () => {
      await disposeAgent();
    },
  };
}
