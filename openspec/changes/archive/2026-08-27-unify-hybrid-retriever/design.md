## Context

内核瘦身重构（`docs/docs/architecture/refactor-plan.md`）Phase 0：`CapabilityRegistry.retrieve` 与 `DocumentIndex.retrieve` 各自内联了同一套「BM25 + 向量 RRF」混合检索，仅「索引结构 / 向量化时机 / 结果映射」不同。先抽唯一实现，再让两处委托。

## Goals / Non-Goals

**Goals:** 唯一 `hybridRetrieve`；两处 `retrieve` 委托它；语义链路失败统一回落词法。

**Non-Goals:** 引入 `Retriever` 接口统一、reranker、缓存、动态 k（后续 Phase）；不改对外检索签名。

## Decisions

- **D1 函数式原语**：`hybridRetrieve(query, topK, { embedding, vectorStore, lexical, ensureVectors? })`，纯编排、无索引所有权；`lexical` 是「按 query 返回降序候选」的回调（能力各自实现 MiniSearch），`ensureVectors` 是可选的惰性向量化钩子。
- **D2 超采集中**：`hybridRetrieve` 内部统一 `topK * 2` 超采，词法/向量各召回 2 倍，RRF 后取 top-k；调用方不再各自超采。
- **D3 优雅回落统一**：语义链路（embed / query / ensureVectors）任一步失败 → 回落词法 `lexical(query, topK)`。`DocumentIndex` 此前未包裹，本次对齐（行为修正，方向一致于「语义召回 best-effort」）。
- **D4 向量化时机不变**：`CapabilityRegistry` 惰性（`ensureVectors`），`DocumentIndex` 在 `addChunks` 时完成（不传 `ensureVectors`）。

## Risks / Trade-offs

- [行为对齐] → `DocumentIndex` 的 query 嵌入失败不再抛错（改为回落词法）；这是有意的一致性修正，不破坏 happy path。
- [抽象边界] → 只抽「检索编排」，索引构建仍归各模块（D3 归属，见规划文档）。

## Migration Plan

- 非破坏：`retrieve` 对外签名不变；仅内部实现改为委托。
