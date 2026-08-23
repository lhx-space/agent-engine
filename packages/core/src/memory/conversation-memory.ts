import type { ChatMessage } from '../llm/types';

export interface ConversationMemoryOptions {
  /**
   * 历史消息最大条数（不含 system）。
   * 超过时保留最近 `maxMessages` 条（丢弃最旧）；未设置或非正数则不裁剪。
   */
  maxMessages?: number;
}

/**
 * 会话上下文窗口：管理单次会话的消息历史（user / assistant / tool）。
 *
 * 约定：不存 system——system prompt 每次 run 由 context 模块动态组装，
 * 存进历史会导致复用旧 prompt。是否存 system 由调用方决定，本类不做 role 过滤。
 */
export class ConversationMemory {
  private readonly messages: ChatMessage[] = [];
  private readonly maxMessages: number | undefined;

  constructor(options: ConversationMemoryOptions = {}) {
    this.maxMessages = options.maxMessages;
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

  /** 清空历史。 */
  clear(): void {
    this.messages.length = 0;
  }

  /** 窗口裁剪：仅当 maxMessages 为正数且超限时，丢弃最旧的溢出部分。 */
  private trim(): void {
    const max = this.maxMessages;
    if (max === undefined || max <= 0) return;
    if (this.messages.length <= max) return;
    this.messages.splice(0, this.messages.length - max);
  }
}
