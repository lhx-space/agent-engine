## Why

AGENTS.md §2.1 的 ⚠️ 清单里还剩「向量库 `VectorStore` + `EmbeddingProvider` 接口尚未定义」。它们是长期记忆语义召回（三层记忆③）与 BM25→向量融合（RRF）的地基。本 change 延续 `MemoryBackend`/`CacheBackend` 的「接口 + 默认 + 注入」模式，把这两块接口层立起来：`VectorStore` 有 in-memory 默认，`EmbeddingProvider` 因必须接真实向量模型而无默认（仅注入）。

## What Changes

- 新增 `VectorStore` 接口（`add` / `query` / `delete` / `clear`）+ `InMemoryVectorStore`（暴力余弦相似度）默认（`core/retrieval/vector-store.ts`）。
- 新增 `EmbeddingProvider` 接口（`name` / `dimension` / `embed(texts)`，`core/embedding/`）；无默认实现（需真实向量模型）。
- `PluginContext` 增 `registerVectorStore` / `registerEmbeddingProvider`；`CapabilityBundle` 携 `vectorStores` / `embeddingProviders` 并 `mergeBundles` 汇聚。
- `assembleAgentLoop` 解析：`vectorStore` = 首个插件注册的 ?? `InMemoryVectorStore`；`embeddingProvider` = 首个插件注册的（可缺省）。随 `ResolvedAgent` 暴露（`vectorStore` 必填、`embeddingProvider` 可选）。
- `@agent-engine/core` 新增 `./embedding` 子路径（`./retrieval` 已有）。

## Capabilities

### Modified Capabilities

- `capability-retrieval`: 新增「语义检索后端（VectorStore + EmbeddingProvider）」需求。
- `plugins`: `PluginContext` / `PluginManager` / `CapabilityBundle` 增语义检索后端注入。

## Impact

- 新增 `packages/core/src/retrieval/vector-store.ts`、`packages/core/src/embedding/{embedding.ts,index.ts}`。
- 修改 `packages/core/src/retrieval/index.ts`、`plugins/{types,manager}.ts`、`capability/{types,bundle}.ts`、`agent/assemble.ts`、`resolve/types.ts`、`index.ts`、`types.ts`、`tsdown.config.ts`、`package.json`。
- 测试：`vector-store.test.ts`（in-memory 余弦召回 / 删除 / 清空）+ `embedding.test.ts`（插件注入 + 缺省 undefined）。
- **非破坏**：均为新增接口/注入点，无配置字段变化，行为不变。
