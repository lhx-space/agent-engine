## Why

「BM25 召回 → embed query → 向量 query → RRF 融合」这套混合检索编排，当前重复写在 `retrieval/registry.ts`（能力检索）与 `documents/document-index.ts`（文档检索）两份，是内核瘦身重构（`docs/docs/architecture/refactor-plan.md`）Phase 0 要消除的第一处重复。

## What Changes

- `core/src/retrieval/hybrid-retriever.ts`：新增 `hybridRetrieve(query, topK, options)`，唯一实现「词法 + 语义双路召回 → RRF 融合」，语义链路失败优雅回落词法。
- `registry.ts` / `document-index.ts`：`retrieve` 改为委托 `hybridRetrieve`，各自只保留「词法召回回调」与「结果映射」。

## Capabilities

### New Capabilities

<!-- 无新能力目录。 -->

### Modified Capabilities

- `capability-retrieval`: `CapabilityRegistry.retrieve` 内部改委托统一混合检索（对外行为不变）。
- `documents`: `DocumentIndex.retrieve` 内部改委托统一混合检索；语义链路失败由「向上抛」对齐为「回落 BM25」。

## Impact

- 新增 `core/src/retrieval/hybrid-retriever.ts`，修改 `retrieval/{registry,index}.ts`、`documents/document-index.ts`。
- 测试：新增 `hybridRetrieve` 单测；既有 312 测试应全部通过。
- **行为对齐**：`DocumentIndex.retrieve` 的 query 嵌入失败由抛错改为回落词法（与能力检索一致，best-effort）。
