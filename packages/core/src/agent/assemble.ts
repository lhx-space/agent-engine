import type { Rule, SecurityConfig, ToolRef } from '@agent-engine/config';
import type { HookPipeline } from '../hooks/pipeline';
import type { LLMProvider } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import { PluginManager } from '../plugins/manager';
import type { Plugin } from '../plugins/types';
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
  /** 安全配置；传入时按 `tools` 引用装配内置工具。 */
  security?: SecurityConfig;
  /** 配置声明的工具引用（`builtin.<name>`），决定注册哪些内置工具。 */
  tools?: ToolRef[];
  /** 预置沙箱后端（bash 启用时使用；缺省按 security.sandbox.backend 解析）。 */
  sandbox?: SandboxBackend;
}

/** 把 prompt 片段追加到 system prompt（string 追加文本 / 模板对象追加到 template；函数式跳过）。 */
function injectPromptText(systemPrompt: SystemPromptInput, promptText: string): SystemPromptInput {
  if (!promptText) return systemPrompt;
  if (typeof systemPrompt === 'function') return systemPrompt;
  if (typeof systemPrompt === 'string') return `${systemPrompt}\n\n${promptText}`;
  return { ...systemPrompt, template: `${systemPrompt.template}\n\n${promptText}` };
}

/**
 * 装配 AgentLoop（「装配层」雏形）：
 * 安装 plugins → 装配内置工具（传 security 时）→ 合并能力（tools 注册 / skills·rules 合并 / hooks 注册 / prompt 片段注入）→ 构造 AgentLoop。
 */
export async function assembleAgentLoop(options: AssembleAgentLoopOptions): Promise<AgentLoop> {
  const manager = new PluginManager();
  await manager.installAll(options.plugins ?? []);
  const assembly = manager.getAssembly();

  const promptFragments = [...assembly.promptFragments];

  if (options.security) {
    const registered = registerBuiltinTools(options.registry, options.security, {
      tools: options.tools,
      sandbox: options.sandbox,
    });
    // 注册了 todo（规划原语）时，注入「复杂任务先列计划」引导（AGENTS.md 6.2）。
    if (registered.includes('builtin.todo')) {
      promptFragments.push(TODO_PLANNING_GUIDANCE);
    }
  }

  for (const tool of assembly.tools) {
    options.registry.register(tool);
  }
  for (const hook of assembly.hooks) {
    options.hooks?.register(hook);
  }

  const skills = [...(options.skills ?? []), ...assembly.skills];
  const rules = [...(options.rules ?? []), ...assembly.rules];
  const promptText = promptFragments.join('\n\n');
  const systemPrompt = injectPromptText(options.systemPrompt, promptText);

  return new AgentLoop({
    provider: options.provider,
    registry: options.registry,
    systemPrompt,
    rules,
    skills,
    hooks: options.hooks,
    guardrails: options.guardrails,
    memory: options.memory,
    maxSteps: options.maxSteps,
  });
}
