/** plugin-pgvector 的表名集合（表名可配，故所有 SQL 需经白名单校验后拼接）。 */
export interface PgvectorTables {
  vectorTable: string;
  memoryTable: string;
  /** 会话表，默认 `agent_sessions`。 */
  sessionTable: string;
  /** 消息表，默认 `agent_messages`。 */
  messageTable: string;
}

/** 迁移版本表名（固定，不随配置变化）。 */
export const VERSION_TABLE = 'agent_schema_migrations';

/** 表名白名单校验（本地受信配置，但仍防御 SQL 注入）。 */
export function assertTableName(name: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`plugin-pgvector: 非法表名 "${name}"`);
  }
}
