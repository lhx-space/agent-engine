## Why

引擎现有持久化层（`plugin-pgvector` 的 `agent_vectors` / `agent_memory` 两张表）有三处会在生产暴露的缺陷：

1. **无命名空间隔离**——多个 agent 共用同一个 `DATABASE_URL` 时，长期记忆与文档向量互相串味，A agent 能召回 B agent 的记忆。
2. **向量维度未约束**——`vector` 列未声明长度，导致既建不了 ivfflat/hnsw 索引（`query` 永远全表 `<=>` 排序），又会让不同 embedding 模型（bge-m3=1024 与 text-embedding-3-small=1536）混写进同一张表且不报错，换模型后旧向量静默变成噪音。
3. **schema 无法演进**——DDL 是 `CREATE TABLE IF NOT EXISTS` 幂等建表，新增列永远不会自动发生；没有版本表、没有迁移目录，任何表结构变更都只能手工执行 SQL。

平台化（SaaS）要求引擎具备「可演进、可隔离、可自托管」的存储层，这三条缺陷必须先修掉，否则会话历史等新表无处安放。

## What Changes

- **新增引擎存储迁移机制**：`migrations/` 目录 + `agent_schema_migrations(version, applied_at)` 版本表；`plugin-pgvector` 启动时按序应用未执行的迁移，单条失败即中止并保留现场。
- **`agent_vectors` 表重构**：新增 `namespace` / `kind` / `ref_id` / `embedding_model` / `dimension` / `content` / `created_at` 列；`vector` 维度改由 `config.embedding.dimension` 决定，写入时校验维度不符直接抛错。
- **`agent_memory` 表扩展**：新增 `namespace` 列并建 `(namespace, key)` 索引，替代无索引的 `LIKE 'prefix%'` 全表扫。
- **`VectorStore` 接口扩展**：`VectorRecord` 增加 `namespace` / `kind` / `refId` / `content`；`query` 增加可选 `filter`（namespace / kind / limit），使存储层具备隔离通道。
- **`SemanticMemory` 简化**：召回直接取 `content` 列，去掉「向量查询 → 回 KV 再取一次原文」的二次查询；写入携带 `namespace` 与 `embedding_model`。
- **BREAKING**：`agent_vectors.vector` 变为固定长度列，已存在的异维度数据需清理或单独迁移；`VectorStore.query` 增加第三参数（可选，向后兼容）。

## Capabilities

### New Capabilities

- `engine-persistence-migrations`: 引擎存储 schema 的版本化迁移机制——迁移目录、版本表、启动时序幂等应用、失败中止与诊断。

### Modified Capabilities

- `capability-retrieval`: `VectorStore` 需支持 namespace / kind 过滤，使向量检索可按 agent 与资产类型隔离。
- `plugin-memory`: 长期记忆写入需携带命名空间与 embedding 模型标识；召回一次查询出结果，不再二次读取 KV。
- `documents`: 文档 chunk 向量需按 agent 命名空间隔离存储，避免与记忆向量混淆。

## Impact

- 代码：`packages/plugins/plugin-pgvector/src/{client,vector-store,memory-backend}.ts`（表结构与迁移）、`packages/core/src/retrieval/*`（`VectorRecord` / `query` 签名）、`packages/core/src/embedding/*`（维度暴露）、`packages/plugins/plugin-memory/src/index.ts`、`packages/plugins/plugin-documents/src/document-index.ts`、`packages/config/src/schema/*`（`embedding.dimension` 升为必填）。
- 数据：现有 pg 库需执行 v2 迁移（`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + 建索引 + 异维度数据清理）。
- 依赖：`plugin-pgvector` 保持零 ORM 依赖（继续用原生 `pg`），不引入 Drizzle。
- 兼容：`VectorStore.query` 第三参数可选，现有实现与调用方无需同步修改。
