import type { ExecutionConfig, Rule, SecurityConfig } from '@agent-engine/config';
import { mergeBundles } from '../capability/bundle';
import type { ResolvedMcpServer } from '../capability-source/types';
import type { CapabilityBundle } from '../capability/types';
import type { HookPipeline } from '../hooks/pipeline';
import type { LLMProvider } from '../llm/types';
import { connectMcpServers } from '../mcp/client';
import type { ConversationMemory } from '../memory/conversation-memory';
import { PluginManager } from '../plugins/manager';
import type { Plugin } from '../plugins/types';
import type { ResolvedAgent } from '../resolve/types';
import type { RuleRegistry } from '../rules/registry';
import type { SandboxBackend } from '../sandbox/types';
import type { Skill } from '../skills/types';
import { registerBuiltinTools } from '../tools/builtin';
import { TODO_PLANNING_GUIDANCE } from '../tools/builtin/todo';
import type { ToolRegistry } from '../tools/registry';
import { AgentLoop } from './loop';
import type { SystemPromptInput } from './types';

export interface AssembleAgentLoopOptions {
  provider: LLMProvider;
  registry: ToolRegistry;
  systemPrompt: SystemPromptInput;
  rules?: Rule[];
  skills?: Skill[];
  plugins?: Plugin[];
  hooks?: HookPipeline;
  guardrails?: RuleRegistry;
  memory?: ConversationMemory;
  maxSteps?: number;
  /** 执行预算 / 重试 / 续写策略（可选，缺省对齐现状）。 */
  execution?: ExecutionConfig;
  /** 安全配置；传入时装配全部内置工具。 */
  security?: SecurityConfig;
  /** 预置沙箱后端（bash 启用时使用；缺省按 security.sandbox.backend 解析）。 */
  sandbox?: SandboxBackend;
  /** 归一化后的 MCP servers（command 形态）；装配时连接并把归一化工具注册进 registry。 */
  mcp?: ResolvedMcpServer[];
}

/** 把 prompt 片段追加到 system prompt（string 追加文本 / 模板对象追加到 template；函数式跳过）。 */
function injectPromptText(systemPrompt: SystemPromptInput, promptText: string): SystemPromptInput {
  if (!promptText) return systemPrompt;
  if (typeof systemPrompt === 'function') return systemPrompt;
  if (typeof systemPrompt === 'string') return `${systemPrompt}\n\n${promptText}`;
  return { ...systemPrompt, template: `${systemPrompt.template}\n\n${promptText}` };
}

/**
 * 装配 AgentLoop（「装配层」）：
 * 安装 plugins → 装配内置工具（传 security 时）→ 连接 mcp → `mergeBundles` 合并 →
 * 注册 tools / hooks、合并 skills·rules、注入 prompt 片段 → 构造 AgentLoop + 聚合 dispose。
 */
export async function assembleAgentLoop(options: AssembleAgentLoopOptions): Promise<ResolvedAgent> {
  // 1. plugin 能力束
  const manager = new PluginManager();
  await manager.installAll(options.plugins ?? []);
  const bundles: CapabilityBundle[] = [manager.getAssembly()];

  // 2. 内置工具直接写 registry（无 dispose），并收集 todo 规划引导片段。
  const derivedFragments: string[] = [];
  if (options.security) {
    const registered = registerBuiltinTools(options.registry, options.security, {
      sandbox: options.sandbox,
    });
    if (registered.includes('builtin.todo')) {
      derivedFragments.push(TODO_PLANNING_GUIDANCE);
    }
  }

  // 3. MCP 能力束（tools + dispose 关闭连接）；单个失败不阻断整体（错误隔离，warn 报告）。
  if (options.mcp && options.mcp.length > 0) {
    const { bundle, errors } = await connectMcpServers(options.mcp);
    bundles.push(bundle);
    for (const { name, error } of errors) {
      console.warn(`[assembleAgentLoop] MCP server "${name}" 连接失败，已跳过：${error.message}`);
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

  const skills = [...(options.skills ?? []), ...merged.skills];
  const rules = [...(options.rules ?? []), ...merged.rules];
  const promptText = [...merged.promptFragments, ...derivedFragments].join('\n\n');
  const systemPrompt = injectPromptText(options.systemPrompt, promptText);

  const agent = new AgentLoop({
    provider: options.provider,
    registry: options.registry,
    systemPrompt,
    rules,
    skills,
    hooks: options.hooks,
    guardrails: options.guardrails,
    memory: options.memory,
    maxSteps: options.maxSteps,
    execution: options.execution,
  });

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    await merged.dispose();
  };

  return { agent, dispose };
}
