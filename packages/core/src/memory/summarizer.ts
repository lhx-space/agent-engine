import type { ChatMessage, LLMProvider } from '../llm/types';

/**
 * 摘要策略抽象：把一段消息压缩为可注入上下文的摘要文本。
 * 三层记忆②（滚动摘要）消费；默认 `LLMSummarizer`，插件可注册自定义实现。
 */
export interface Summarizer {
  readonly name: string;
  summarize(messages: ChatMessage[]): Promise<string>;
}

/** 开发默认：用会话 `LLMProvider` 把旧轮消息压缩为一段摘要。 */
export class LLMSummarizer implements Summarizer {
  readonly name = 'llm';

  constructor(private readonly provider: LLMProvider) {}

  async summarize(messages: ChatMessage[]): Promise<string> {
    const transcript = messages
      .map((message) => `${message.role}: ${message.content ?? ''}`)
      .join('\n');
    const result = await this.provider.chatCompletion({
      messages: [
        {
          role: 'system',
          content:
            '你是对话摘要器。把下面的对话压缩为一段简洁的摘要，保留关键事实、用户诉求与已得出的结论；不要添加新信息。',
        },
        { role: 'user', content: transcript },
      ],
    });
    return result.message.content ?? '';
  }
}
