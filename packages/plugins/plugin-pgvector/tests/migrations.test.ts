import { describe, expect, it } from '@rstest/core';
import { MIGRATIONS, applyMigrations } from '../src/migrations';
import type { PoolLike } from '../src/migrations/types';
import { VERSION_TABLE } from '../src/tables';

interface Recorded {
  sql: string;
  params?: unknown[];
}

interface Stub {
  pool: PoolLike;
  queries: Recorded[];
}

/** 桩连接：记录全部 SQL，按 `applied` 返回已应用版本，可按谓词模拟失败。 */
function createStub(options: { applied?: number[]; failOn?: (sql: string) => boolean } = {}): Stub {
  const queries: Recorded[] = [];
  const client = {
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params });
      if (options.failOn?.(sql)) throw new Error('simulated failure');
      if (sql.includes(`SELECT version FROM ${VERSION_TABLE}`)) {
        return { rows: (options.applied ?? []).map((version) => ({ version })) };
      }
      return { rows: [] };
    },
    release() {},
  };
  return { pool: { connect: async () => client }, queries };
}

const TABLES = {
  vectorTable: 'agent_vectors',
  memoryTable: 'agent_memory',
  sessionTable: 'agent_sessions',
  messageTable: 'agent_messages',
};
const sqlOf = (queries: Recorded[]) => queries.map((entry) => entry.sql);

describe('MIGRATIONS', () => {
  it('按版本号升序排列', () => {
    const versions = MIGRATIONS.map((migration) => migration.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
  });
});

describe('applyMigrations', () => {
  it('空库应用全部迁移并记录版本', async () => {
    const stub = createStub();
    await applyMigrations(stub.pool, TABLES, 1024);

    expect(
      sqlOf(stub.queries).some((sql) =>
        sql.includes(`CREATE TABLE IF NOT EXISTS ${VERSION_TABLE}`),
      ),
    ).toBe(true);
    const inserts = stub.queries.filter((entry) => entry.sql.startsWith('INSERT INTO'));
    expect(inserts.map((entry) => entry.params?.[0])).toEqual([1, 2, 3]);
    expect(stub.queries.filter((entry) => entry.sql === 'BEGIN').length).toBe(3);
    expect(stub.queries.filter((entry) => entry.sql === 'COMMIT').length).toBe(3);
  });

  it('已应用的版本被跳过（增量升级）', async () => {
    const stub = createStub({ applied: [1] });
    await applyMigrations(stub.pool, TABLES, 1024);

    const inserts = stub.queries.filter((entry) => entry.sql.startsWith('INSERT INTO'));
    expect(inserts.map((entry) => entry.params?.[0])).toEqual([2, 3]);
  });

  it('重复启动幂等：不重复执行任何迁移', async () => {
    const stub = createStub({ applied: [1, 2, 3] });
    await applyMigrations(stub.pool, TABLES, 1024);

    expect(stub.queries.some((entry) => entry.sql === 'BEGIN')).toBe(false);
    expect(stub.queries.some((entry) => entry.sql.startsWith('INSERT INTO'))).toBe(false);
  });

  it('迁移失败即中止：回滚该条且不记录版本', async () => {
    const stub = createStub({ failOn: (sql) => sql.includes('ALTER TABLE agent_vectors') });
    await expect(applyMigrations(stub.pool, TABLES, 1024)).rejects.toThrow(/migration 2/);

    expect(stub.queries).toContainEqual({ sql: 'ROLLBACK', params: undefined });
    const inserts = stub.queries.filter((entry) => entry.sql.startsWith('INSERT INTO'));
    expect(inserts.map((entry) => entry.params?.[0])).toEqual([1]);
  });

  it('错误信息含 version 与 name', async () => {
    const stub = createStub({
      failOn: (sql) => sql.includes('CREATE TABLE IF NOT EXISTS agent_vectors'),
    });
    await expect(applyMigrations(stub.pool, TABLES)).rejects.toThrow(
      /migration 1 \(baseline-vectors-and-memory\) failed/,
    );
  });

  it('未配置维度时建不定长 vector 列', async () => {
    const stub = createStub();
    await applyMigrations(stub.pool, TABLES);

    const create = stub.queries.find((entry) =>
      entry.sql.includes('CREATE TABLE IF NOT EXISTS agent_vectors'),
    );
    expect(create?.sql).toContain('vector vector NOT NULL');
  });

  it('配置维度时建固定长度 vector(N) 列', async () => {
    const stub = createStub();
    await applyMigrations(stub.pool, TABLES, 1024);

    const create = stub.queries.find((entry) =>
      entry.sql.includes('CREATE TABLE IF NOT EXISTS agent_vectors'),
    );
    expect(create?.sql).toContain('vector vector(1024) NOT NULL');
  });

  it('释放连接（避免连接泄漏）', async () => {
    const stub = createStub();
    let released = false;
    const pool: PoolLike = {
      connect: async () => {
        const client = await stub.pool.connect();
        return {
          ...client,
          release: () => {
            released = true;
          },
        };
      },
    };
    await applyMigrations(pool, TABLES);
    expect(released).toBe(true);
  });
});
