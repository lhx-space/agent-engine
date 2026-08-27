## Why

能力（rules/skills/documents/memory/web/mcp）已全部外放为 `plugin-xxx`，各自自建索引 + 复用 `hybridRetrieve`。core 里遗留的「能力检索」一等公民——`CapabilityType` 闭合枚举、`CapabilityLoader`、`CapabilityRegistry`、`Bm25Retriever`——已无消费者，是死代码。本 change 删除它们，让 core 只留检索协议（`Retriever` / `Reranker` 接口 + `hybridRetrieve`）与后端抽象。

## What Changes

- **删闭合枚举与能力检索实现**：`retrieval/{loader,registry,types}.ts`（`CapabilityLoader` / `CapabilityRegistry` / `CapabilityType` / `CapabilityMeta` / `CapabilityHit`）删除。
- **删 `Bm25Retriever`**（依赖 `CapabilityRegistry`），`Retriever` 接口保留 + 新增 `noopRetriever`（默认返回空候选）；`assemble` 默认改为 `noopRetriever`。
- **瘦身依赖**：core 移除 `minisearch` 与能力外放遗留的 `mammoth` / `epub2` / `turndown` / `unpdf` / `gray-matter` / `readability` / `linkedom`。

## Capabilities

### Modified Capabilities

- `capability-retrieval`: 移除 `CapabilityRegistry` / `BM25 检索` / `CapabilityLoader` / `能力检索语义化` 需求；`检索策略接口` 默认实现由 `Bm25Retriever` 改为 `noopRetriever`；保留 `VectorStore + EmbeddingProvider` 与 `hybridRetrieve`。

## Impact

- 修改 `packages/core/src/retrieval/{loader.ts（删）,registry.ts（删）,types.ts（删）,retriever.ts,index.ts}`、`agent/assemble.ts`、`index.ts`、`types.ts`、`package.json`。
- 迁移 `packages/core/tests/{retrieval,capability-semantic-recall,context-retrieval}.test.ts`。
- 兼容性：无 config 字段变化（能力检索为内部实现，不对外暴露）。
