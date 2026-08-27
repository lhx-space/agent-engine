import type { SystemPrompt } from '@agent-engine/config';

/**
 * system prompt 三种形态：
 * - string：静态字符串；
 * - SystemPrompt：模板对象（渲染用户变量）；
 * - 函数：按 userInput 动态生成（完全自定义组装）。
 */
export type SystemPromptInput =
  string | SystemPrompt | ((userInput: string) => string | Promise<string>);

export interface BuildSystemPromptOptions {
  /** system-prompt 模板与用户变量。 */
  systemPrompt: SystemPrompt;
}
