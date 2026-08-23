import type { Rule } from '@agent-engine/config';
import type { Hook } from '../hooks/types';
import type { Skill } from '../skills/types';
import type { Tool } from '../tools/types';

/**
 * 插件：最大的扩展单元，可打包多个 tools / skills / hooks / rules / prompt 片段，
 * 通过 `install(ctx)` 一次性注入能力。
 */
export interface Plugin {
  /** 唯一标识（如 `@agent-engine/plugin-otel`）。 */
  name: string;
  /** 匹配面：后续接入统一检索时的 meta description。 */
  description: string;
  /** 语义化版本。 */
  version: string;
  /** 同义词，后续接入统一检索时的 meta tags。 */
  tags?: string[];
  install(ctx: PluginContext): void | Promise<void>;
}

/** 插件与内核之间的能力注入桥梁。 */
export interface PluginContext {
  registerTool(tool: Tool): void;
  registerSkill(skill: Skill): void;
  registerHook(hook: Hook): void;
  registerRule(rule: Rule): void;
  provideSystemPrompt(fragment: string): void;
}

/** 插件安装后收集的能力集合，供装配层合并。 */
export interface PluginAssembly {
  tools: Tool[];
  skills: Skill[];
  hooks: Hook[];
  rules: Rule[];
  promptFragments: string[];
}
