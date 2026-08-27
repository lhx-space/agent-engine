import type { SystemPrompt } from '@agent-engine/config';

/**
 * system prompt 三种形态：
 * - string：静态字符串；
 * - SystemPrompt：模板对象（配合 `skills` 每次 run 自动检索注入）；
 * - 函数：按 userInput 动态生成（完全自定义组装）。
 */
export type SystemPromptInput =
  string | SystemPrompt | ((userInput: string) => string | Promise<string>);

export interface BuildSystemPromptOptions {
  /** system-prompt 模板与用户变量。 */
  systemPrompt: SystemPrompt;
  /** 命中 skills 的指令拼接文本（可选，调用方检索后传入）。 */
  skillsText?: string;
}
