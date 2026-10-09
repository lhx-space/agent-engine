## Context

引擎的持久化能力目前全部由 `plugin-pgvector` 承载，它在连接池创建时用幂等 DDL 建两张表：

```44:56:/Users/luhanxin/Desktop/agent-engine/packages/plugins/plugin-pgvector/src/client.ts
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${vectorTable} (
        id text PRIMARY KEY,
        vector vector NOT NULL,
        metadata jsonb
      )`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${memoryTable} (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
```

约束条件（来自项目纪律与本次决策）：

- 内核插件**不引入 ORM**，继续用原生 `pg`，保持 `plugin-pgvector` 零新增依赖、可独立发布（平台层另用 Drizzle）。
- 遵循 §2.1 的尺子：core 只定义接口 + 提供 in-memory 默认实现 + 注入点，具体后端由插件提供。
- 物理部署先「同库双 schema」（`engine.*` / `platform.*`），代码按可拆库设计，两层只通过字符串 id 软关联。
- 第一版不做登录与多租户，`namespace` 承担隔离职责即可。

## Goals / Non-Goals

**Goals:**

- 让引擎存储 schema 可版本化演进（有迁移目录、有版本表、可回滚诊断）。
- 让向量与记忆数据按 agent / 资产类型隔离，多 agent 共用一库不串味。
- 让 embedding 模型可追溯：换模型不产生静默污染，而是显式报错。
- 让召回路径减少一次往返（向量表直接带原文）。
- 为后续「会话历史」等新表提供可依赖的迁移基础设施。

**Non-Goals:**

- 不引入 ORM 或迁移框架到内核插件。
- 不做 pg → 其他数据库的可移植抽象（仍绑定 PostgreSQL + pgvector）。
- 不在此变更中建会话表（属 `add-conversation-store`）。
- 不做向量索引（hnsw/ivfflat）的自动创建——数据量规模未定，留到有实测后再加。
- 不处理分库分表、多租户计费。

## Decisions

### 决策 1：自建轻量迁移机制，而非引入框架

`plugin-pgvector` 必须保持零 ORM 依赖，因此实现约 80 行的迁移器：

- `migrations/` 目录，每个文件导出 `{ version: number, name: string, up: (pool) => Promise<void> }`。
- `agent_schema_migrations(version int PK, name text, applied_at timestamptz)` 版本表。
- 启动时 `SELECT max(version)`，按序执行未应用的迁移；每条在自己的事务里，失败即中止并抛出带 version 的错误。
- 迁移只做「向前」，回滚靠人工 SQL（与数据量级匹配）。

**备选**：引入 `node-pg-migrate` / `graphile-migrate`。否决理由：给内核插件加外部依赖违背「内核轻量」纪律，且我们只需要建表/加列，不需要框架的下移、回滚、校验等能力。

### 决策 2：用 `namespace` 字符串列做隔离，而非按 agent 分表

`namespace` 取值形如 `devops-agent:memory`、`devops-agent:document`，由 `{agentName}:{kind}` 拼成；`kind` 单独成列便于按类型检索与统计。

**备选**：每个 agent 一张表（`agent_vectors_devops`）。否决理由：表数量随 agent 线性膨胀，DDL 频繁，连接池与元数据管理成本高；字符串列 + 复合索引在可预见规模内足够。

### 决策 3：向量维度由配置声明并写入校验

`config.embedding.dimension` 升为**必填**；建表时 `vector(N)` 固定长度；`PgVectorStore.add()` 校验 `vector.length === N`，不符抛明确错误。同时 `embedding_model` 列记录来源模型，检索可按模型过滤。

**备选**：保留不定长 `vector` 列。否决理由：不建索引、跨模型静默污染，两者都是生产事故级隐患。代价是换 embedding 模型需要一次数据迁移——这恰恰是我们希望**显式化**的成本。

### 决策 4：`content` 列直存原文，取消二次查询

`SemanticMemory.recall` 现在要「向量查询拿 id → 去 `agent_memory` 取 text」两次往返。新模型下向量表自带 `content`，一次查询即可返回原文；`ref_id` 同时指向来源消息/文档，支持从记忆反查原始上下文。

`agent_memory` 表保留（非语义 KV 仍有用途，且接口不变），仅加 `namespace` 列与索引。

### 决策 5：`VectorStore.query` 增加可选 filter，保持向后兼容

```ts
query(vector: number[], topK: number, filter?: { namespace?: string; kind?: string }): Promise<VectorMatch[]>
```

`VectorRecord` 增加可选 `namespace` / `kind` / `refId` / `content`。全部可选，现有 `InMemoryVectorStore` 与调用方无需同步改动。

### 决策 6：`namespace` 由装配层注入，不污染调用方

`namespace` 不从 `AgentConfig` 的零散字段推导，而在 `resolveAgentConfig` 阶段按 `config.name`（或 `agentId`）生成，通过 `PgVectorStore` / `PgMemoryBackend` 构造参数注入。能力插件（`plugin-memory` / `plugin-documents`）只负责传 `kind` 与 `refId`，不感知命名空间规则。

## Risks / Trade-offs

- **[异维度旧数据]** 现存库若已写入与 `dimension` 不符的向量，`vector(N)` 的 ALTER 会失败 → 迁移 v2 第一步先 `DELETE FROM agent_vectors WHERE ...` 无法判定维度，改为：迁移前由运维执行清理脚本，或迁移检测冲突时抛出明确指引错误而非静默失败。
- **[固定维度的未来成本]** 换 embedding 模型需重建向量 → 通过 `embedding_model` 列可精确筛出需重建的数据，`dimension` 变更走一次新迁移（v3）。
- **[无向量索引]** 数据量上万后 `query` 全表排序会变慢 → 维度固定后随时可补 `hnsw` 索引，作为独立迁移引入；先记录基线。
- **[迁移中断]** 迁移事务化，失败中止；但 DDL 在 PG 中可事务回滚，风险可控。需保证启动阶段迁移失败时给出可诊断的错误（含 version 与 SQL 摘要）。
- **[两套迁移并存]** 平台层 Drizzle 与引擎层自建迁移并行 → 二者操作不同 schema，互不干扰；文档明确「engine schema 归 plugin-pgvector，platform schema 归 Drizzle」。

## Migration Plan

1. 落地迁移器与 `agent_schema_migrations` 表（v1 = 现状基线，仅建版本表）。
2. v2 迁移：`agent_vectors` 加七列 + `vector` 改固定维度前缀处理 + `agent_memory` 加 `namespace` 列 + 建两个复合索引。
3. 部署：插件启动时自动应用；失败则拒绝启动（避免半旧半新 schema 被写入）。
4. 回滚：手工执行对应 `ALTER TABLE ... DROP COLUMN`；数据侧保留旧列内容（`ADD COLUMN` 不丢数据）。
5. 验证：本地 `agent-engine-pgvector` 容器上跑一遍「旧库 → 迁移 → 读写」回归。

## Open Questions

- `namespace` 是否需要在 `kind` 之外再区分「租户」——第一版单租户，留 `user_id` 列占位还是完全不加？（倾向：不加，靠 `namespace` 前缀扩展即可）
- `dimension` 是否允许不同 agent 用不同模型（则 `vector(N)` 无法统一）？第一版按全局单一维度处理，多模型场景后续再评估分表。
