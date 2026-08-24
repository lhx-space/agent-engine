import type { Rule } from '@agent-engine/config';
import type { Hook } from '../hooks/types';
import type { Skill } from '../skills/types';
import type { Tool } from '../tools/types';
import type { CapabilityBundle } from './types';

/** `mergeBundles` 的输出：扁平化的能力列表 + 聚合 dispose。 */
export interface MergedBundles {
  tools: Tool[];
  skills: Skill[];
  hooks: Hook[];
  rules: Rule[];
  promptFragments: string[];
  /** 关闭所有 bundle 的资源（幂等）。 */
  dispose: () => Promise<void>;
}

/**
 * 把多个 `CapabilityBundle` 合并为扁平列表，并聚合各 bundle 的 `dispose`。
 * 这是「横向能力 → AgentLoop sinks」的单一汇聚点：新增能力来源只需产出 bundle，
 * 不触碰 loop / assemble。
 */
export function mergeBundles(bundles: CapabilityBundle[]): MergedBundles {
  const tools: Tool[] = [];
  const skills: Skill[] = [];
  const hooks: Hook[] = [];
  const rules: Rule[] = [];
  const promptFragments: string[] = [];
  const disposers: (() => Promise<void>)[] = [];

  for (const bundle of bundles) {
    tools.push(...bundle.tools);
    skills.push(...bundle.skills);
    hooks.push(...bundle.hooks);
    rules.push(...bundle.rules);
    promptFragments.push(...bundle.promptFragments);
    if (bundle.dispose) disposers.push(bundle.dispose);
  }

  return {
    tools,
    skills,
    hooks,
    rules,
    promptFragments,
    dispose: async () => {
      await Promise.all(disposers.map((dispose) => dispose()));
    },
  };
}
