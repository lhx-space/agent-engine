import { InMemoryConversationStore } from '@lhx-agent-engine/core';
import type { ConversationStore } from '@lhx-agent-engine/core';
import type { AgentConfig } from '@lhx-agent-engine/config';
import { PgConversationStore, createPgvectorPool } from '@lhx-agent-engine/plugin-pgvector';

export interface ConversationHandle {
  store: ConversationStore;
  /** pg 后端需要释放连接池；in-memory 为空操作。 */
  dispose: () => Promise<void>;
  /** 是否跨进程持久化（in-memory 时仅本进程有效）。 */
  persistent: boolean;
}

/**
 * 平台侧读取对话历史的入口：只按 `config.session.store` 直连后端，
 * **不走** `resolveAgentConfig`——列历史不需要装插件、更不需要给文档建向量索引。
 *
 * 引擎库的会话通过字符串 `agentName` 与平台侧的 agent 关联（无跨库外键）。
 */
export async function openConversationStore(config: AgentConfig): Promise<ConversationHandle> {
  if (config.session?.store === 'pg') {
    const { pool, tables } = await createPgvectorPool({
      namespace: config.name,
      dimension: config.embedding?.dimension,
    });
    return {
      store: new PgConversationStore(pool, {
        sessionTable: tables.sessionTable,
        messageTable: tables.messageTable,
      }),
      dispose: async () => {
        await pool.end();
      },
      persistent: true,
    };
  }
  return { store: new InMemoryConversationStore(), dispose: async () => {}, persistent: false };
}
