import type { Rule } from '@agent-engine/config';
import type { ChatMessage } from '../llm/types';
import type { ConversationMemory } from '../memory/conversation-memory';
import type { LongTermMemory } from '../memory/long-term-memory';
import type { CapabilityLoader, CapabilityRecordHit } from '../retrieval/loader';
import { loadRulesText } from '../rules/load';
import type { Skill } from '../skills/types';
import { buildSystemPrompt } from './build-system-prompt';
import type { SystemPromptInput } from './types';

/** `ContextComposer` 的构造依赖。 */
export interface ComposeContextInput {
  systemPrompt: SystemPromptInput;
  rules: Rule[];
  ruleLoader?: CapabilityLoader<Rule>;
  skillLoader?: CapabilityLoader<Skill>;
  memory?: ConversationMemory;
  longTermMemory?: LongTermMemory;
}

/** 上下文组装结果：完整 messages + 各中间产物（供调用方注册 skill 工具 / 观测）。 */
export interface ComposeContextResult {
  messages: ChatMessage[];
  skillHits: CapabilityRecordHit<Skill>[];
  rulesText: string;
  skillsText: string;
  memories: string[];
  systemPrompt: string;
}

/**
 * 上下文组装器（「加载策略 / 装载」）：把静态 system prompt、检索到的 rules/skills、
 * 长期记忆召回、会话窗口，拼成发给 LLM 的 messages。
 * 与 `memory`（数据源）正交——本类只负责「装载」，skill 工具注册等副作用由调用方处理。
 */
export class ContextComposer {
  private readonly systemPrompt: SystemPromptInput;
  private readonly rules: Rule[];
  private readonly ruleLoader: CapabilityLoader<Rule> | undefined;
  private readonly skillLoader: CapabilityLoader<Skill> | undefined;
  private readonly memory: ConversationMemory | undefined;
  private readonly longTermMemory: LongTermMemory | undefined;

  constructor(input: ComposeContextInput) {
    this.systemPrompt = input.systemPrompt;
    this.rules = input.rules;
    this.ruleLoader = input.ruleLoader;
    this.skillLoader = input.skillLoader;
    this.memory = input.memory;
    this.longTermMemory = input.longTermMemory;
  }

  async compose(userInput: string, injectedFragment = ''): Promise<ComposeContextResult> {
    const rulesText = this.ruleLoader ? loadRulesText(this.rules, this.ruleLoader, userInput) : '';
    const skillHits = this.skillLoader?.loadForQuery(userInput) ?? [];
    const skillsText = skillHits
      .map((hit) => `## ${hit.record.id}\n${hit.record.instruction}`)
      .join('\n\n');

    const baseSystem = await this.resolveSystemPrompt(userInput, rulesText, skillsText);
    const memories = (await this.longTermMemory?.recall(userInput)) ?? [];
    const fragments = [
      injectedFragment,
      memories.length > 0 ? `[长期记忆]\n${memories.join('\n')}` : '',
    ].filter((text) => text.length > 0);
    const systemPrompt =
      fragments.length > 0 ? `${baseSystem}\n\n${fragments.join('\n\n')}` : baseSystem;

    const history = (await this.memory?.getWindow()) ?? [];
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userInput },
    ];

    return { messages, skillHits, rulesText, skillsText, memories, systemPrompt };
  }

  private async resolveSystemPrompt(
    userInput: string,
    rulesText: string,
    skillsText: string,
  ): Promise<string> {
    if (typeof this.systemPrompt === 'function') {
      return this.appendContext(await this.systemPrompt(userInput), rulesText, skillsText);
    }
    if (typeof this.systemPrompt === 'string') {
      return this.appendContext(this.systemPrompt, rulesText, skillsText);
    }
    return buildSystemPrompt({ systemPrompt: this.systemPrompt, rulesText, skillsText });
  }

  private appendContext(base: string, rulesText: string, skillsText: string): string {
    const extra = [rulesText, skillsText].filter((text) => text).join('\n\n');
    return extra ? `${base}\n\n${extra}` : base;
  }
}
