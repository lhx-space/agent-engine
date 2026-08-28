/**
 * 长期记忆抽象（三层记忆③）：跨会话把文本向量化写入向量库并持久化，按 query 语义召回。
 * 实现（如 `SemanticMemory`）已外放为 `@lhx-agent-engine/plugin-memory`；core 只保留协议与 no-op 默认。
 */
export interface LongTermMemory {
  readonly name: string;
  remember(text: string): Promise<void>;
  recall(query: string, topK?: number): Promise<string[]>;
}

/** 无长期记忆的默认实现：`remember` no-op、`recall` 返回空（有 embedding 实现才启用语义记忆）。 */
export const noopLongTermMemory: LongTermMemory = {
  name: 'none',
  remember: async () => {},
  recall: async () => [],
};
