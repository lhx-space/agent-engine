import type { Tool } from '@agent-engine/core/tools';

/** 可复用能力包：一份指令（SKILL.md 正文）+ 可选捆绑工具。 */
export interface Skill {
  /** 唯一标识（自建索引的 id）。 */
  id: string;
  /** 匹配面：BM25 检索的核心，要精准。 */
  description: string;
  /** SKILL.md 正文指令，命中后注入 system prompt。 */
  instruction: string;
  /** 可选捆绑工具，命中后经 contributor 临时注册。 */
  tools?: Tool[];
  /** 同义词，缓解 BM25 词面漏检。 */
  tags: string[];
}
