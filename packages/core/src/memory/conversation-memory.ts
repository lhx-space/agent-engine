import type { ChatMessage } from '../llm/types';
import type { ConversationMemoryOptions } from './types';

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

  /**
   * 窗口裁剪：仅当 maxMessages 为正数且超限时，按「整轮边界」从头部淘汰。
   * 裁剪点对齐到 `user` 消息起点，避免拆散 assistant `tool_call` 与其后的 `tool` 结果配对
   * （拆散会导致下一轮 messages 非法）。
   */
  private trim(): void {
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
