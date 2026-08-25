import type { ContextCompactor } from '../context/compactor';
import type { Summarizer } from './summarizer';

export interface ConversationMemoryOptions {
  /**
   * 历史消息最大条数（不含 system）。
   * 超过时保留最近 `maxMessages` 条（丢弃最旧）；未设置或非正数则不裁剪。
   */
  maxMessages?: number;
  /** token 预算裁剪器（三层记忆①）；配置后条数裁剪退位，统一在 `getWindow()` 裁剪。 */
  compactor?: ContextCompactor;
  /** token 预算（`compactor` 生效时使用）。 */
  budgetTokens?: number;
  /** 滚动摘要器（三层记忆②）；`budgetTokens` 裁剪淘汰的旧轮经它摘要注入。 */
  summarizer?: Summarizer;
}
