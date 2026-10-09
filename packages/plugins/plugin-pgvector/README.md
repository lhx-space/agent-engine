# @lhx-agent-engine/plugin-pgvector

pgvector-backed vector store + long-term memory KV persistence. Implements core's `VectorStore` (semantic retrieval) and `MemoryBackend` (cross-session KV) on a single PostgreSQL instance.

## Install

```bash
pnpm add @lhx-agent-engine/plugin-pgvector
```

## Usage

Connection string is read from `DATABASE_URL` by default; pass `connectionString` explicitly to override.

```ts
import { createPgvectorPlugin } from '@lhx-agent-engine/plugin-pgvector';

const plugin = createPgvectorPlugin({ connectionString: process.env.DATABASE_URL });
```

`preset-default` already wires the factory (`@lhx-agent-engine/plugin-pgvector`). Activate it per-agent via `plugins` and select the KV backend by name:

```yaml
plugins:
  - '@lhx-agent-engine/plugin-pgvector'
memory:
  longTerm:
    backend: pg # 选中 PgMemoryBackend；向量后端取首个注册的 vectorStore（pgvector）
session:
  store: pg # 选中 PgConversationStore（对话历史落 pg，刷新页面可续接）
embedding:
  provider: openai-compatible # DeepSeek 无 embeddings，需 OpenAI / 本地 ollama
  baseURL: https://api.openai.com/v1
  model: text-embedding-3-small
  dimension: 1536 # 必填：建 vector(1536) 并在写入时校验维度
```

## API

- `createPgvectorPlugin(config?)` — returns a `Plugin` that registers `PgVectorStore` (name `pgvector`) + `PgMemoryBackend` (name `pg`). Options: `connectionString` / `vectorTable` / `memoryTable` / `dimension` / `namespace` / `embeddingModel`.
- `PgVectorStore` — implements `VectorStore` (`add` / `query` / `delete` / `clear`); `<=>` cosine distance, score = `1 - distance`. `query` accepts an optional filter (`namespace` / `kind`).
- `PgMemoryBackend` — implements `MemoryBackend` (`get` / `set` / `delete` / `keys` / `clear`), scoped by `namespace`.
- `PgConversationStore` — implements `ConversationStore` (name `pg`): `createSession` / `appendMessage` / `listMessages` / `listSessions` / `deleteSession` / `endSession`.
- `createPgvectorPool(config?)` — creates the pg pool and applies versioned migrations (see below).

## Tables

- `agent_vectors(id text pk, namespace text, kind text, ref_id text, embedding_model text, dimension int, vector vector(N), content text, metadata jsonb, created_at timestamptz)`
- `agent_memory(key text pk, namespace text, value jsonb, updated_at timestamptz)`
- `agent_sessions(id text pk, agent_name text, user_id text, title text, status text, message_count int, meta jsonb, created_at timestamptz, updated_at timestamptz)`
- `agent_messages(id bigint pk identity, session_id text fk→agent_sessions(id) on delete cascade, seq int, role text, content text, tool_calls jsonb, tool_call_id text, name text, tokens int, meta jsonb, created_at timestamptz, unique(session_id, seq))`
- `agent_schema_migrations(version int pk, name text, applied_at timestamptz)`

`vector(N)` 的 N 取自 `config.embedding.dimension`；未配置则建不定长 `vector` 列且不做写入校验。

## Migrations

表结构变更一律走 `src/migrations/`（每条含 `version` / `name` / `up`，只向前），由 `applyMigrations` 在连接池创建时按序应用，
已应用版本记在 `agent_schema_migrations`。单条迁移在自己的事务中执行，失败即回滚并中止初始化，错误含 `version` 与 `name`。
回滚由运维按迁移文件注释里的逆向 SQL 手工执行（不提供自动 down）。

- v1 `baseline-vectors-and-memory` — 向量表 + 记忆表（新库一次成型）
- v2 `namespaced-vectors-with-dimension` — 命名空间 / kind / ref_id / content / 模型列、维度收敛、复合索引
- v3 `conversation-sessions-and-messages` — 会话与消息表（对话历史持久化，外键级联删除）

换 embedding 模型是显式成本：存量向量维度与新维度不符时 v2 会中止并给出清理指引，绝不静默混检。

## Isolation

`namespace` 由装配层按 agent 名注入（多 agent 共用一库时记忆与向量互不串味）；`kind` 区分 `memory` / `document` / `skill` / `rule`。
两者都由索引 `(namespace, kind)` 支撑，`clear()` 只清理本命名空间，不会误删其他 agent 的数据。
