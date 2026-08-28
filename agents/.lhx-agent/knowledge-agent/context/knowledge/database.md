# 数据库设计

> 本文档定义数据库实例、表结构、索引、迁移、备份与性能规范。所有 schema 变更必须更新本文档并走评审。

## 目录

1. 实例与连接
2. 表结构
3. 索引规范
4. 迁移规范
5. 备份与恢复
6. 性能优化
7. 容量规划

## 一、实例与连接

- PostgreSQL 16，扩展 `pgvector`（`CREATE EXTENSION IF NOT EXISTS vector`）。
- 本地连接串：`postgres://agent:agent@localhost:5432/agent`（经 `DATABASE_URL` 注入）。
- 生产连接串由密钥系统注入，禁止硬编码。

## 二、表结构

### agent_vectors（语义向量）

| 字段     | 类型   | 约束     | 说明                  |
| -------- | ------ | -------- | --------------------- |
| id       | text   | PK       | 记忆/文档唯一标识     |
| vector   | vector | NOT NULL | 语义向量              |
| metadata | jsonb  | 可空     | 元数据（含原文 text） |

检索语句：

```sql
SELECT id, metadata, 1 - (vector <=> $1::vector) AS score
FROM agent_vectors
ORDER BY vector <=> $1::vector
LIMIT $2;
```

`<=>` 为余弦距离（0 = 完全相同，2 = 完全相反），`1 - 距离` 归一化为相似度。

### agent_memory（长期记忆 KV）

| 字段       | 类型        | 约束                   | 说明     |
| ---------- | ----------- | ---------------------- | -------- |
| key        | text        | PK                     | 记忆 id  |
| value      | jsonb       | NOT NULL               | 记忆内容 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 更新时间 |

## 三、索引规范

| 场景                 | 索引                                        |
| -------------------- | ------------------------------------------- |
| 精确匹配（key/id）   | B-tree（主键自带）                          |
| 模糊搜索             | `pg_trgm` GIN 索引                          |
| 向量检索（> 1 万行） | pgvector HNSW（召回高）或 IVFFlat（内存省） |
| jsonb 字段查询       | GIN 索引                                    |

原则：只给高频查询建索引，避免索引膨胀拖慢写入；每个索引都要有对应的慢查询依据。

## 四、迁移规范

- 所有 schema 变更必须**可回滚**（每个 `UP` 对应一个 `DOWN`）。
- 禁止直接改生产表，走 migration 工具 + 评审。
- 大表 DDL 用 `CREATE INDEX CONCURRENTLY` 避免锁表。
- 破坏性变更（删列/改类型）需「先加新列 → 双写 → 迁移数据 → 切读 → 删旧列」的渐进式流程。

## 五、备份与恢复

| 项       | 策略                               |
| -------- | ---------------------------------- |
| 全量备份 | 每日一次                           |
| 增量     | WAL 归档，可做 PITR（时间点恢复）  |
| 保留     | 全量保留 30 天，归档保留 90 天     |
| 演练     | 每季度一次恢复演练，验证 RPO / RTO |

恢复目标：RPO ≤ 15 分钟，RTO ≤ 1 小时。

## 六、性能优化

- 慢查询定位：`pg_stat_statements`（按 `max_exec_time` 排序）。
- 连接池：应用侧连接池上限与 `max_connections` 匹配，避免「too many clients」。
- 长事务：设置 `idle_in_transaction_session_timeout` 自动 kill 空闲事务。
- 读写分离：读多写少场景走只读副本。

## 七、容量规划

- 向量维度 × 数据量估算存储：`行数 × (维度 × 4 字节 + metadata)`。
- 数据量 > 100 万行时评估分区 / 分表。
- 监控指标：连接数、慢查询数、磁盘使用率、复制延迟。
