import type { ContextCompactor } from '../context/compactor';
import type { ChatMessage } from '../llm/types';
import type { Summarizer } from './summarizer';
import type { ConversationMemoryOptions } from './types';

/** 滚动摘要注入历史时的头部标记。 */
const SUMMARY_PREFIX = '[历史摘要]\n';

/**
 * 会话上下文窗口：管理单次会话的消息历史（user / assistant / tool）。
 *
 * 约定：不存 system——system prompt 每次 run 由 context 模块动态组装，
 * 存进历史会导致复用旧 prompt。是否存 system 由调用方决定，本类不做 role 过滤。
 *
 * 三层记忆①②消费点：`getWindow()` 按 token 预算整轮淘汰，并把被淘汰的旧轮经
 * `Summarizer` 摘要后作为头部 user 消息注入（滚动摘要）。
 */
export class ConversationMemory {
  private readonly messages: ChatMessage[] = [];
  private summary = '';
  private readonly maxMessages: number | undefined;
  private readonly compactor: ContextCompactor | undefined;
  private readonly budgetTokens: number | undefined;
  private readonly summarizer: Summarizer | undefined;

  constructor(options: ConversationMemoryOptions = {}) {
    this.maxMessages = options.maxMessages;
    this.compactor = options.compactor;
    this.budgetTokens = options.budgetTokens;
    this.summarizer = options.summarizer;
  }

  /** 追加单条消息，并触发窗口裁剪。 */
  push(message: ChatMessage): void {
    this.messages.push(message);
    this.trim();
  }

  /** 批量追加消息，并触发一次窗口裁剪。 */
  append(messages: ChatMessage[]): void {
    this.messages.push(...messages);
    this.trim();
  }

  /** 返回当前历史（副本，避免外部直接改写内部状态）。 */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /** 当前历史条数。 */
  get size(): number {
    return this.messages.length;
  }

  /** 清空历史与滚动摘要。 */
  clear(): void {
    this.messages.length = 0;
    this.summary = '';
  }

  /**
   * 返回本轮可用的历史窗口：token 预算整轮淘汰（`compactor` + `budgetTokens`）→
   * 淘汰轮并入滚动摘要（`summarizer`）→ 摘要作为头部 user 消息注入。
   * 未配置 token 预算时退化为条数裁剪（`append` 时已按整轮淘汰）。
   */
  async getWindow(): Promise<ChatMessage[]> {
    let window = this.messages;
    if (
      this.compactor &&
      this.budgetTokens !== undefined &&
      this.budgetTokens > 0 &&
      window.length > 0
    ) {
      const kept = await this.compactor.compact(window, this.budgetTokens);
      const evictedCount = window.length - kept.length;
      if (evictedCount > 0) {
        const evicted = window.slice(0, evictedCount);
        if (this.summarizer && evicted.length > 0) {
          const fresh = await this.summarizer.summarize(evicted);
          if (fresh) {
            this.summary = this.summary ? `${this.summary}\n\n${fresh}` : fresh;
          }
        }
        // 提交淘汰：被淘汰轮从原始历史移除，避免下次重复摘要。
        this.messages.splice(0, evictedCount);
        window = kept;
      }
    }

    if (this.summary) {
      return [{ role: 'user', content: `${SUMMARY_PREFIX}${this.summary}` }, ...window];
    }
    return [...window];
  }

  /**
   * 窗口裁剪（条数）：仅当 `maxMessages` 为正数且超限时，按「整轮边界」从头部淘汰。
   * 配置了 `compactor` 时退位——裁剪统一由 `getWindow()` 负责，此处不再按条数丢弃。
   */
  private trim(): void {
    if (this.compactor) return;
    const max = this.maxMessages;
    if (max === undefined || max <= 0) return;
    if (this.messages.length <= max) return;

    // 目标裁点：至少淘汰 length - max 条；再前移对齐到 user（轮次起点）。
    let cut = this.messages.length - max;
    while (cut < this.messages.length && this.messages[cut]?.role !== 'user') {
      cut += 1;
    }
    if (cut >= this.messages.length) {
      // 预算内没有轮次起点：退回到最近的 user，保留最近一个完整轮次（宁略超预算，不拆散配对）。
      cut = this.messages.length - 1;
      while (cut > 0 && this.messages[cut]?.role !== 'user') {
        cut -= 1;
      }
    }
    this.messages.splice(0, cut);
  }
}
