import type { Tool } from '../tools/types';

/** `ContextContributor.contribute` 的入参（当前仅 userInput 作检索查询）。 */
export interface ContextContributeInput {
  userInput: string;
}

/** 贡献产物：要注入 system prompt 的文本片段 + 要本轮临时注册的工具。 */
export interface ContextContribution {
  text?: string;
  tools?: Tool[];
}

/**
 * 上下文贡献者：能力向 context 贡献「文本 + 临时工具」的统一扩展缝。
 * rules / skills / documents / memory 等能力最终都实现本接口，经
 * `PluginContext.registerContextContributor` 注册；内核只收集调用，不关心具体能力类型。
 */
export interface ContextContributor {
  readonly name: string;
  contribute(input: ContextContributeInput): Promise<ContextContribution | void>;
}
