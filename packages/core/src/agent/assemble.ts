import type {
  ExecutionConfig,
  SecurityConfig,
  SessionMemory,
  ToolsConfig,
} from '@agent-engine/config';
import { InMemoryCacheBackend } from '../cache/cache-backend';
import type { CacheBackend } from '../cache/cache-backend';
import { mergeBundles } from '../capability/bundle';
import type { ResolvedMcpServer } from '../capability-source/types';
import type { CapabilityBundle } from '../capability/types';
import { TokenBudgetCompactor } from '../context/compactor';
import type { ContextCompactor } from '../context/compactor';
import { ApproximateTokenCounter } from '../context/token-counter';
import type { TokenCounter } from '../context/token-counter';
import type { EmbeddingProvider } from '../embedding/embedding';
import { EventBus } from '../events/event-bus';
import type { HookPipeline } from '../hooks/pipeline';
import type { LLMProvider } from '../llm/types';
import { connectMcpServers } from '../mcp/client';
import { ConversationMemory } from '../memory/conversation-memory';
import type { LongTermMemory } from '../memory/long-term-memory';
import { noopLongTermMemory } from '../memory/long-term-memory';
import { InMemoryMemoryBackend } from '../memory/memory-backend';
import type { MemoryBackend } from '../memory/memory-backend';
import { LLMSummarizer } from '../memory/summarizer';
import type { Summarizer } from '../memory/summarizer';
import { PluginManager } from '../plugins/manager';
import type { Plugin } from '../plugins/types';
import type { ResolvedAgent } from '../resolve/types';
import { IdentityReranker } from '../retrieval/reranker';
import type { Reranker } from '../retrieval/reranker';
import { Bm25Retriever } from '../retrieval/retriever';
import type { Retriever } from '../retrieval/retriever';
import { CapabilityRegistry } from '../retrieval/registry';
import { InMemoryVectorStore } from '../retrieval/vector-store';
import type { VectorStore } from '../retrieval/vector-store';
import type { GuardrailRule } from '../guardrails';
import type { SandboxBackend } from '../sandbox/types';
import { registerBuiltinTools } from '../tools/builtin';
import { TODO_PLANNING_GUIDANCE } from '../tools/builtin/todo';
import type { ToolRegistry } from '../tools/registry';
import { AgentLoop } from './loop';
import type { SystemPromptInput } from './types';

export interface AssembleAgentLoopOptions {
  provider: LLMProvider;
  registry: ToolRegistry;
  systemPrompt: SystemPromptInput;
  plugins?: Plugin[];
  hooks?: HookPipeline;
  guardrails?: GuardrailRule[];
  memory?: ConversationMemory;
  /** 长期记忆实现（缺省 no-op；语义实现由 `@agent-engine/plugin-memory` 提供）。 */
  longTermMemory?: LongTermMemory;
  maxSteps?: number;
  /** 执行预算 / 重试 / 续写策略（可选，缺省对齐现状）。 */
  execution?: ExecutionConfig;
  /** 安全配置；传入时装配全部内置工具。 */
  security?: SecurityConfig;
  /** 工具轴配置；`disabled` 在全部工具（builtin / plugin / mcp）注册完成后按名移除。 */
  tools?: ToolsConfig;
  /** 预置沙箱后端（bash 启用时使用；缺省按 security.sandbox.backend 解析）。 */
  sandbox?: SandboxBackend;
  /** 归一化后的 MCP servers（command 形态）；装配时连接并把归一化工具注册进 registry。 */
  mcp?: ResolvedMcpServer[];
  /** 长期记忆后端名（缺省 in-memory）；按名解析内置/插件注册的后端。 */
  longTermBackend?: string;
  /** 缓存后端名（缺省 in-memory）；按名解析内置/插件注册的后端。 */
  cacheBackend?: string;
  /** 预置 embedding provider（按 `embedding` 配置解析；插件注册的优先）。 */
  embeddingProvider?: EmbeddingProvider;
  /** 预置事件总线（缺省新建；测试可注入以断言事件）。 */
  eventBus?: EventBus;
  /** 会话记忆配置（`config.memory.session`）；未注入 `memory` 时据此构造（token 预算 + 滚动摘要）。 */
  sessionMemory?: SessionMemory;
  /** 预置滚动摘要策略（插件注册的优先；缺省 `LLMSummarizer(provider)`）。 */
  summarizer?: Summarizer;
}

/** 把 prompt 片段追加到 system prompt（string 追加文本 / 模板对象追加到 template；函数式跳过）。 */
function injectPromptText(systemPrompt: SystemPromptInput, promptText: string): SystemPromptInput {
  if (!promptText) return systemPrompt;
  if (typeof systemPrompt === 'function') return systemPrompt;
  if (typeof systemPrompt === 'string') return `${systemPrompt}\n\n${promptText}`;
  return { ...systemPrompt, template: `${systemPrompt.template}\n\n${promptText}` };
}

/**
 * 按名解析可插拔后端：内置默认 + 插件注册的后端（同名后者覆盖）；未注册名字抛可读错误。
 */
function resolveBackendByName<T extends { readonly name: string }>(
  name: string,
  builtin: T,
  plugins: T[],
  configKey: string,
): T {
  const registry = new Map<string, T>([[builtin.name, builtin]]);
  for (const backend of plugins) {
    registry.set(backend.name, backend);
  }
  const backend = registry.get(name);
  if (!backend) {
    throw new Error(
      `Unknown ${configKey} backend "${name}". Available: ${[...registry.keys()].join(', ')}`,
    );
  }
  return backend;
}

/**
 * 装配 AgentLoop（「装配层」）：
 * 安装 plugins → 装配内置工具（传 security 时）→ 连接 mcp → `mergeBundles` 合并 →
 * 注册 tools / hooks、注入 prompt 片段 → 构造 AgentLoop + 聚合 dispose。
 */
export async function assembleAgentLoop(options: AssembleAgentLoopOptions): Promise<ResolvedAgent> {
  const eventBus = options.eventBus ?? new EventBus();

  // 1. plugin 能力束（逐个安装并发 plugin.installed 事件）。
  const manager = new PluginManager();
  for (const plugin of options.plugins ?? []) {
    await manager.install(plugin);
    eventBus.emit({ type: 'plugin.installed', name: plugin.name });
  }
  const bundles: CapabilityBundle[] = [manager.getAssembly()];

  // 2. 内置工具直接写 registry（无 dispose）。
  if (options.security) {
    registerBuiltinTools(options.registry);
  }

  // 3. MCP 能力束（tools + dispose 关闭连接）；单个失败不阻断整体（错误隔离 + 事件报告）。
  if (options.mcp && options.mcp.length > 0) {
    const { bundle, errors } = await connectMcpServers(options.mcp);
    bundles.push(bundle);
    const failedNames = new Set(errors.map(({ name }) => name));
    for (const server of options.mcp) {
      if (!failedNames.has(server.name)) {
        eventBus.emit({ type: 'mcp.connected', name: server.name });
      }
    }
    for (const { name, error } of errors) {
      console.warn(`[assembleAgentLoop] MCP server "${name}" 连接失败，已跳过：${error.message}`);
      eventBus.emit({ type: 'mcp.failed', name, error: error.message });
    }
  }

  // 4. 单一汇聚点：把 bundles 合并成扁平能力列表 + 聚合 dispose。
  const merged = mergeBundles(bundles);

  for (const tool of merged.tools) {
    options.registry.register(tool);
  }
  for (const hook of merged.hooks) {
    options.hooks?.register(hook);
  }

  // 4.5 工具轴：装配末按名移除被禁用工具（覆盖 builtin / plugin / mcp 三类来源）。
  for (const name of options.tools?.disabled ?? []) {
    options.registry.unregister(name);
  }

  // 4.6 发 tool.registered 事件（最终仍注册进 registry 的工具）。
  for (const tool of options.registry.list()) {
    eventBus.emit({ type: 'tool.registered', name: tool.name });
  }

  // 5. todo 规划引导：仅在 todo 最终仍注册时注入（被 `tools.disabled` 禁用则不再引导）。
  const derivedFragments: string[] = [];
  if (options.registry.has('builtin.todo')) {
    derivedFragments.push(TODO_PLANNING_GUIDANCE);
  }

  const promptText = [...merged.promptFragments, ...derivedFragments].join('\n\n');
  const systemPrompt = injectPromptText(options.systemPrompt, promptText);

  // 5.5 上下文/检索/摘要策略接口：插件注册优先，否则默认（token 计数 + 裁剪 + 检索 + 重排 + 摘要）。
  const tokenCounter: TokenCounter = merged.tokenCounters[0] ?? new ApproximateTokenCounter();
  const contextCompactor: ContextCompactor =
    merged.contextCompactors[0] ?? new TokenBudgetCompactor(tokenCounter);
  const retriever: Retriever = merged.retrievers[0] ?? new Bm25Retriever(new CapabilityRegistry());
  const reranker: Reranker = merged.rerankers[0] ?? new IdentityReranker();
  const summarizer: Summarizer =
    merged.summarizers[0] ?? options.summarizer ?? new LLMSummarizer(options.provider);

  // 5.6 可插拔存储/检索后端：按名解析（内置 in-memory + 插件注册）。
  const memoryBackend: MemoryBackend = resolveBackendByName(
    options.longTermBackend ?? 'in-memory',
    new InMemoryMemoryBackend(),
    merged.memoryBackends,
    'memory.longTerm.backend',
  );
  const cacheBackend: CacheBackend = resolveBackendByName(
    options.cacheBackend ?? 'in-memory',
    new InMemoryCacheBackend(),
    merged.cacheBackends,
    'cache.backend',
  );
  const vectorStore: VectorStore = merged.vectorStores[0] ?? new InMemoryVectorStore();
  const embeddingProvider: EmbeddingProvider | undefined =
    merged.embeddingProviders[0] ?? options.embeddingProvider;

  // 5.7 长期记忆：实现已外放为 `@agent-engine/plugin-memory`（SemanticMemory）；core 默认 no-op。
  const longTermMemory: LongTermMemory = options.longTermMemory ?? noopLongTermMemory;

  // 5.8 会话记忆：注入的 memory 直接用；否则按 config.memory.session 构造（token 预算 + 滚动摘要）。
  const session = options.sessionMemory;
  const memory: ConversationMemory =
    options.memory ??
    new ConversationMemory({
      maxMessages: session?.maxMessages,
      compactor: contextCompactor,
      budgetTokens: session?.maxTokens,
      summarizer: session?.summary ? summarizer : undefined,
    });

  // 5.9 guardrail 装配：预置可执行规则 + 插件注册的规则，合并成 `GuardrailRule[]`（core 只认协议）。
  // 声明式 `config.guardrails` 的解释已外放为 `@agent-engine/plugin-guardrails`（经 registerGuardrail 注入）。
  const guardrails: GuardrailRule[] = [...(options.guardrails ?? []), ...merged.guardrails];

  const agent = new AgentLoop({
    provider: options.provider,
    registry: options.registry,
    systemPrompt,
    hooks: options.hooks,
    guardrails,
    memory,
    longTermMemory,
    embeddingProvider,
    contextContributors: merged.contextContributors,
    maxSteps: options.maxSteps,
    execution: options.execution,
    eventBus,
  });

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    await merged.dispose();
  };

  return {
    agent,
    memoryBackend,
    cacheBackend,
    vectorStore,
    embeddingProvider,
    longTermMemory,
    eventBus,
    tokenCounter,
    contextCompactor,
    retriever,
    reranker,
    dispose,
  };
}
