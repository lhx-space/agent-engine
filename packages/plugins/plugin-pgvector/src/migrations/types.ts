import type { PgvectorTables } from '../tables';

/** `pg.PoolClient` 的最小结构约束（便于单测注入桩，测试无需真实数据库）。 */
export interface Queryable {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

/** `pg.Pool` 的最小结构约束：能借出一条专用连接（事务必须用同一条连接）。 */
export interface PoolLike {
  connect: () => Promise<Queryable & { release: () => void }>;
}

/** 迁移执行上下文：`client` 为已开启事务的专用连接，所有语句必须用 `ctx.client.query`。 */
export interface MigrationContext {
  client: Queryable;
  tables: PgvectorTables;
  /** 向量维度；未配置时建不定长 `vector` 列，且写入不做维度校验。 */
  dimension?: number;
}

/** 单条迁移：只实现 `up`，回滚由运维按文件注释中的逆向 SQL 手工执行。 */
export interface Migration {
  version: number;
  name: string;
  up: (ctx: MigrationContext) => Promise<void>;
}
