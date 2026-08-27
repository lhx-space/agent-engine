import type { DocumentIndex } from '../documents/document-index';
import type { ChatMessage } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import type { LongTermMemory } from '../memory/long-term-memory';
import type { CapabilityLoader, CapabilityRecordHit } from '../retrieval/loader';
import type { Skill } from '../skills/types';
import { buildSystemPrompt } from './build-system-prompt';
import type { SystemPromptInput } from './types';

/** `ContextComposer` 的构造依赖。 */
export interface ComposeContextInput {
  systemPrompt: SystemPromptInput;
  skillLoader?: CapabilityLoader<Skill>;
  memory?: ConversationMemory;
  longTermMemory?: LongTermMemory;
  /** 文档检索索引（可选）；run 时按 userInput 检索 top-k 注入 `[文档]`。 */
  documentIndex?: DocumentIndex;
}

/** 上下文组装结果：完整 messages + 各中间产物（供调用方注册 skill 工具 / 观测）。 */
export interface ComposeContextResult {
  messages: ChatMessage[];
  skillHits: CapabilityRecordHit<Skill>[];
  skillsText: string;
  memories: string[];
  systemPrompt: string;
}

/**
 * 上下文组装器（「加载策略 / 装载」）：把静态 system prompt、检索到的 skills、
 * 长期记忆召回、会话窗口，拼成发给 LLM 的 messages。
 * 与 `memory`（数据源）正交——本类只负责「装载」，skill 工具注册等副作用由调用方处理。
 * rules 已外放为 `@agent-engine/plugin-rules`，经 `ContextContributor` 注入，不再经本类。
 */
export class ContextComposer {
  private readonly systemPrompt: SystemPromptInput;
  private readonly skillLoader: CapabilityLoader<Skill> | undefined;
  private readonly memory: ConversationMemory | undefined;
  private readonly longTermMemory: LongTermMemory | undefined;
  private readonly documentIndex: DocumentIndex | undefined;

  constructor(input: ComposeContextInput) {
    this.systemPrompt = input.systemPrompt;
    this.skillLoader = input.skillLoader;
    this.memory = input.memory;
    this.longTermMemory = input.longTermMemory;
    this.documentIndex = input.documentIndex;
  }

  async compose(userInput: string, injectedFragment = ''): Promise<ComposeContextResult> {
    const skillHits = this.skillLoader ? await this.skillLoader.loadForQuery(userInput) : [];
    const skillsText = skillHits
      .map((hit) => `## ${hit.record.id}\n${hit.record.instruction}`)
      .join('\n\n');

    const baseSystem = await this.resolveSystemPrompt(userInput, skillsText);
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

    return { messages, skillHits, skillsText, memories, systemPrompt };
  }

  private async resolveSystemPrompt(userInput: string, skillsText: string): Promise<string> {
    if (typeof this.systemPrompt === 'function') {
      return this.appendContext(await this.systemPrompt(userInput), skillsText);
    }
    if (typeof this.systemPrompt === 'string') {
      return this.appendContext(this.systemPrompt, skillsText);
    }
    return buildSystemPrompt({ systemPrompt: this.systemPrompt, skillsText });
  }

  private appendContext(base: string, skillsText: string): string {
    return skillsText ? `${base}\n\n${skillsText}` : base;
  }
}
