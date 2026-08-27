import type { DocumentIndex } from '../documents/document-index';
import type { ChatMessage } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import type { LongTermMemory } from '../memory/long-term-memory';
import { buildSystemPrompt } from './build-system-prompt';
import type { SystemPromptInput } from './types';

/** `ContextComposer` 的构造依赖。 */
export interface ComposeContextInput {
  systemPrompt: SystemPromptInput;
  memory?: ConversationMemory;
  longTermMemory?: LongTermMemory;
  /** 文档检索索引（可选）；run 时按 userInput 检索 top-k 注入 `[文档]`。 */
  documentIndex?: DocumentIndex;
}

/** 上下文组装结果：完整 messages + 各中间产物（供调用方观测）。 */
export interface ComposeContextResult {
  messages: ChatMessage[];
  memories: string[];
  systemPrompt: string;
}

/**
 * 上下文组装器（「加载策略 / 装载」）：把静态 system prompt、长期记忆召回、会话窗口，
 * 拼成发给 LLM 的 messages。rules / skills 已外放为 `plugin-rules` / `plugin-skills`，
 * 经 `ContextContributor` 注入（`injectedFragment`），不再经本类。
 */
export class ContextComposer {
  private readonly systemPrompt: SystemPromptInput;
  private readonly memory: ConversationMemory | undefined;
  private readonly longTermMemory: LongTermMemory | undefined;
  private readonly documentIndex: DocumentIndex | undefined;

  constructor(input: ComposeContextInput) {
    this.systemPrompt = input.systemPrompt;
    this.memory = input.memory;
    this.longTermMemory = input.longTermMemory;
    this.documentIndex = input.documentIndex;
  }

  async compose(userInput: string, injectedFragment = ''): Promise<ComposeContextResult> {
    const baseSystem = await this.resolveSystemPrompt(userInput);
    const memories = (await this.longTermMemory?.recall(userInput)) ?? [];
    const docChunks = this.documentIndex ? await this.documentIndex.retrieve(userInput) : [];
    const docText = docChunks.map((chunk) => chunk.text).join('\n\n');
    const fragments = [
      injectedFragment,
      memories.length > 0 ? `[长期记忆]\n${memories.join('\n')}` : '',
      docText.length > 0 ? `[文档]\n${docText}` : '',
    ].filter((text) => text.length > 0);
    const systemPrompt =
      fragments.length > 0 ? `${baseSystem}\n\n${fragments.join('\n\n')}` : baseSystem;

    const history = (await this.memory?.getWindow()) ?? [];
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userInput },
    ];

    return { messages, memories, systemPrompt };
  }

  private async resolveSystemPrompt(userInput: string): Promise<string> {
    if (typeof this.systemPrompt === 'function') {
      return this.systemPrompt(userInput);
    }
    if (typeof this.systemPrompt === 'string') {
      return this.systemPrompt;
    }
    return buildSystemPrompt({ systemPrompt: this.systemPrompt });
  }
}
