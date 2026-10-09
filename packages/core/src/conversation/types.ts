/** 消息角色：与 `ChatMessage` 对齐，额外保留 system 以便在需要时完整归档。 */
export type ConversationRole = 'user' | 'assistant' | 'tool' | 'system';

/** 会话记录（`agent_sessions` 行）。 */
export interface ConversationSession {
  id: string;
  agentName?: string;
  userId?: string;
  title?: string;
  status?: 'active' | 'ended';
  messageCount?: number;
  meta?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/** 消息记录（`agent_messages` 行）。`seq` 由存储侧分配，保证会话内有序。 */
export interface ConversationMessage {
  id?: string;
  /** 会话内单调序号，由存储侧分配；读取时按升序返回。 */
  seq?: number;
  role: ConversationRole;
  content?: string | null;
  /** 结构化工具调用（assistant 发起），回放时可折叠展示。 */
  toolCalls?: unknown;
  /** `role='tool'` 时关联的 tool_call id。 */
  toolCallId?: string;
  /** 工具名。 */
  name?: string;
  /** 该条消息的 token 数（可选，供上下文预算与统计使用）。 */
  tokens?: number;
  meta?: Record<string, unknown>;
  createdAt?: string;
}

/** 消息读取选项：限量 + 向前翻页游标。 */
export interface ListMessagesOptions {
  /** 只取最近 N 条（按 seq 降序取后升序返回）。 */
  limit?: number;
  /** 只取 seq 小于该值的消息（向前翻页）。 */
  beforeSeq?: number;
}

/** 会话列举选项。 */
export interface ListSessionsOptions {
  agentName?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

/**
 * 对话历史存储后端（可插拔）：与 `MemoryBackend` / `CacheBackend` / `VectorStore` 同构，
 * 经 `PluginContext.registerConversationStore` 注入，由 `config.session.store` 按名选中。
 *
 * 与 `MemoryBackend`（KV）分工明确：本接口面向 append + 按会话范围有序读取，
 * 不提供 KV 语义；与引擎的「活 Agent 实例缓存」（server 层 `SessionCache`）无关。
 */
export interface ConversationStore {
  readonly name: string;
  /** 创建会话；同 id 已存在时按 upsert 处理。 */
  createSession(session: ConversationSession): Promise<ConversationSession>;
  /** 追加一条消息；会话不存在时按 create 处理（`agentName` 取自入参或留空）。 */
  appendMessage(sessionId: string, message: ConversationMessage): Promise<void>;
  /** 读取会话消息（按 seq 升序）。 */
  listMessages(sessionId: string, options?: ListMessagesOptions): Promise<ConversationMessage[]>;
  /** 列举会话（按 updatedAt 降序）。 */
  listSessions(options?: ListSessionsOptions): Promise<ConversationSession[]>;
  /** 删除会话及其消息；不存在时返回 false。 */
  deleteSession(sessionId: string): Promise<boolean>;
  /** 可选：标记会话结束（只改状态，不删消息）。 */
  endSession?(sessionId: string): Promise<void>;
}
