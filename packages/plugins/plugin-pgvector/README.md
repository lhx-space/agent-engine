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
embedding:
  provider: openai-compatible # DeepSeek 无 embeddings，需 OpenAI / 本地 ollama
  baseURL: https://api.openai.com/v1
  model: text-embedding-3-small
```

## API

- `createPgvectorPlugin(config?)` — returns a `Plugin` that registers `PgVectorStore` (name `pgvector`) + `PgMemoryBackend` (name `pg`).
- `PgVectorStore` — implements `VectorStore` (`add` / `query` / `delete` / `clear`); `<=>` cosine distance, score = `1 - distance`.
- `PgMemoryBackend` — implements `MemoryBackend` (`get` / `set` / `delete` / `keys` / `clear`).
- `createPgvectorPool(config?)` — creates the pg pool and idempotently ensures the extension + tables.

## Tables

- `agent_vectors(id text pk, vector vector, metadata jsonb)`
- `agent_memory(key text pk, value jsonb, updated_at timestamptz)`
