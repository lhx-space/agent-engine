import { InMemoryConversationStore } from '@lhx-agent-engine/core';
import type { ConversationStore } from '@lhx-agent-engine/core';
import { PgConversationStore, createPgvectorPool } from '@lhx-agent-engine/plugin-pgvector';
import { scanAgentDir } from './agent-dir';

export interface ConversationHandle {
  store: ConversationStore;
  dispose: () => Promise<void>;
  /** 是否真的跨进程持久化（in-memory 时仅进程内有效）。 */
  persistent: boolean;
}

/**
 * 解析某 agent 的对话历史后端（只读历史场景的轻量入口）。
 *
 * 这里刻意**不走** `resolveAgentConfig`：列历史不需要装插件、也不需要给文档建向量索引
 * （那是重量级操作）。只按 `config.session.store` 直连对应后端即可。
 * - `pg`：连 `DATABASE_URL`，经 plugin-pgvector 的迁移确保 `agent_sessions` / `agent_messages` 就绪
 * - 其余：退回 `InMemoryConversationStore`（进程内，重启即失）
 */
export async function resolveConversationStore(name: string): Promise<ConversationHandle> {
  const { config } = await scanAgentDir(name);

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

  return {
    store: new InMemoryConversationStore(),
    dispose: async () => {},
    persistent: false,
  };
}
