import type { SystemPrompt } from '@agent-engine/config';

export interface BuildSystemPromptOptions {
  /** system-prompt 模板与用户变量。 */
  systemPrompt: SystemPrompt;
  /** 规则注入文本（可选，调用方检索后传入）。 */
  rulesText?: string;
  /** 命中 skills 的指令拼接文本（可选，调用方检索后传入）。 */
  skillsText?: string;
}
