## 1. 迁移机制

- [x] 1.1 在 `packages/plugins/plugin-pgvector/src/migrations/` 建迁移文件约定（`{ version, name, up }`）与 `index.ts` 按序导出
- [x] 1.2 实现 `applyMigrations(pool, tables)`：建 `agent_schema_migrations` 版本表 → 读已应用最大版本 → 逐条事务执行 → 记录 version
- [x] 1.3 迁移失败时抛出含 `version` / `name` / 原因的异常，并中止后续初始化
- [x] 1.4 迁移文件注释中标注对应逆向 SQL（不实现自动 down）
- [x] 1.5 单元测试：空库全量应用、增量跳过、重复启动幂等、中途失败中止（`packages/plugins/plugin-pgvector/tests/`）

## 2. 表结构迁移 v2

- [x] 2.1 写 v1 基线迁移（建 `agent_schema_migrations`，幂等）
- [x] 2.2 写 v2 迁移：`agent_vectors` 加 `namespace` / `kind` / `ref_id` / `embedding_model` / `dimension` / `content` / `created_at`
- [x] 2.3 v2 迁移：`agent_vectors.vector` 改为固定长度 `vector(N)`，N 取 `config.embedding.dimension`；冲突时抛可诊断错误
- [x] 2.4 v2 迁移：`agent_memory` 加 `namespace` 列并建 `(namespace, key)` 索引
- [x] 2.5 v2 迁移：建 `agent_vectors (namespace, kind)` 与 `agent_vectors (embedding_model)` 索引
- [x] 2.6 在 `client.ts` 中移除裸 DDL，改为调用 `applyMigrations`

## 3. 配置层

- [x] 3.1 `packages/config`：`EmbeddingConfigSchema` 的 `dimension` 升为必填（Zod），补充校验错误提示
- [x] 3.2 更新现有 agent 配置样例（`.lhx-agent/*/context/system.md`）补 `dimension: 1024`

## 4. core 接口扩展

- [x] 4.1 `VectorRecord` 增加可选 `namespace` / `kind` / `refId` / `content`
- [x] 4.2 `VectorStore.query` 增加可选第三参数 `filter: { namespace?, kind? }`
- [x] 4.3 `InMemoryVectorStore` 实现 filter（不传时行为不变）
- [x] 4.4 `EmbeddingProvider` 确保暴露 `name` / `dimension`；`createEmbeddingProvider` 在无 dimension 配置时首次 embed 后回填
- [x] 4.5 单元测试：filter 生效、不传向后兼容、维度不符报错

## 5. pg 实现改造

- [x] 5.1 `PgVectorStore` 构造接收 `namespace` 与 `dimension`；`add` 校验维度并写入全部新列
- [x] 5.2 `PgVectorStore.query` 按 `filter.namespace` / `filter.kind` 追加 WHERE，返回 `content`
- [x] 5.3 `PgMemoryBackend` 支持 `namespace` 作用域（构造注入或列过滤），`keys()` 走索引而非全表 LIKE
- [x] 5.4 `PgVectorStore` / `PgMemoryBackend` 的 `clear()` 限定在本 namespace 内（禁止 TRUNCATE 全表）

## 6. 能力插件适配

- [x] 6.1 `plugin-memory`：`remember` 携带 `kind='memory'` / `content` / `embedding_model`；`recall` 去掉二次 KV 读取
- [x] 6.2 `plugin-documents`：`loadDocuments` / `DocumentIndex` 写入时带 `kind='document'`
- [x] 6.3 `plugin-skills`：向量写入带 `kind='skill'`（保持现有 in-memory 行为不变）
- [x] 6.4 装配层（`resolve`）：按 `config.name` 生成 `namespace` 并注入各后端

## 7. 验证与文档

- [x] 7.1 在 `agent-engine-pgvector` 容器上跑「旧库 → v2 迁移 → 读写」回归
- [x] 7.2 更新 `packages/plugins/plugin-pgvector/README.md` 的 Tables 段落与迁移说明
- [x] 7.3 更新 `AGENTS.md` §2.1 表格：标注存储层已具备迁移机制与命名空间隔离
