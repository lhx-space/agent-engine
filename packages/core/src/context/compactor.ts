import type { ChatMessage } from '../llm/types';
import type { TokenCounter } from './token-counter';

/**
 * 上下文裁剪抽象：把超预算的消息历史压缩/裁剪到预算内，返回可继续使用的消息。
 * 三层记忆②（滚动摘要）可替换为「LLM 摘要旧轮」的实现；默认按 token 预算整轮淘汰。
 */
export interface ContextCompactor {
  readonly name: string;
  compact(messages: ChatMessage[], budgetTokens: number): Promise<ChatMessage[]>;
}

/**
 * 开发默认：按 token 预算从头部淘汰「整轮」（user 起点切轮），
 * 保证不拆散 assistant tool_call 与其后的 tool 结果配对；单轮超预算时至少保留最后一轮。
 */
export class TokenBudgetCompactor implements ContextCompactor {
  readonly name = 'token-budget';

  constructor(private readonly tokenCounter: TokenCounter) {}

  async compact(messages: ChatMessage[], budgetTokens: number): Promise<ChatMessage[]> {
    if (messages.length === 0) return messages;

    const turnStarts: number[] = [];
    for (let i = 0; i < messages.length; i += 1) {
      if (messages[i]?.role === 'user') turnStarts.push(i);
    }
    if (turnStarts.length === 0) return messages;

    let keptFrom = messages.length;
    let total = 0;
    for (let t = turnStarts.length - 1; t >= 0; t -= 1) {
      const start = turnStarts[t]!;
      const end = t + 1 < turnStarts.length ? turnStarts[t + 1]! : messages.length;
      const turnTokens = messages
        .slice(start, end)
        .reduce((sum, message) => sum + this.tokenCounter.count(message.content ?? ''), 0);
      if (total + turnTokens > budgetTokens) break;
      total += turnTokens;
      keptFrom = start;
    }

    // 单轮就超预算：至少保留最后一轮，避免丢光当前上下文。
    if (keptFrom === messages.length) {
      keptFrom = turnStarts[turnStarts.length - 1]!;
    }
    return messages.slice(keptFrom);
  }
}
