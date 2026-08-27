## Context

能力检索（rules/skills）走 `CapabilityRegistry`（MiniSearch 索引 meta 的 `description`+`tags`）→ `CapabilityLoader.loadForQuery` → `loadRulesText` / `ContextComposer`。`reciprocalRankFusion`（RRF）、`EmbeddingProvider`、`VectorStore` 已就位（文档检索与长期记忆在用），本变更把同一套能力复用到能力检索。

## Goals / Non-Goals

**Goals:** `CapabilityRegistry` 混合检索（BM25 + 向量 RRF）；`embedding` 配置自动启用能力语义召回；无 embedding 回落 BM25；语义召回失败优雅回落 BM25（best-effort）。

**Non-Goals:** 把 `Retriever` 抽象（`Bm25Retriever`）与实际能力检索路径统一（仍为平行存在，后续）；pgvector 能力向量库注入；动态 k / reranker。

## Decisions

- **D1 复用 RRF 原语**：`CapabilityRegistry.retrieve` 双路召回后调 `reciprocalRankFusion`，与 `DocumentIndex` 同构。
- **D2 惰性向量化**：meta 在 `CapabilityLoader` 构造时 BM25 注册（同步），向量在首次 `retrieve` 时惰性 `ensureVectors()` 一次性建好并缓存（避免 `AgentLoop` 同步构造器被迫 async）。
- **D3 嵌入面 = description + tags**：语义嵌入 `meta.description + meta.tags.join(' ')`，与 BM25 的匹配面一致。
- **D4 优雅回落**：`retrieve` 对「embedding 调用 / 向量查询 / 建向量」整体 try/catch，任何语义链路失败都回落 BM25（能力检索是 run 时路径，不能因 embedding 故障拖垮整轮）。
- **D5 默认向量库**：`embedding` 存在且未注入 `vectorStore` 时，`CapabilityRegistry` 内部建 `InMemoryVectorStore`（能力自有向量索引，不与长期记忆/文档共享）。
- **D6 async 签名**：`retrieve` / `loadForQuery` / `loadRulesText` 转 async；`ContextComposer.compose` 本就 async，`await` 无结构改动。`Bm25Retriever.retrieve` 已 async，仅补 `await`。

## Risks / Trade-offs

- [首轮延迟] → 惰性向量化把 embedding 成本放到首次 `compose`（首个用户消息）；元信息量级小（rules/skills 数量级），可接受。
- [签名破坏] → 同步转 async，需同步更新调用点与测试（v0.1 内部 API）。
- [向量库共享] → 能力向量索引与长期记忆各用独立 `InMemoryVectorStore`，id 命名空间隔离，无碰撞。

## Migration Plan

- `CapabilityLoader` 第 3 参由 `registry?` 改为 `options`（含 `registry`/`embedding`/`vectorStore`）；现有唯一传 `registry` 的测试改为 `{ registry }`。
- `loadRulesText` 与 `loadForQuery` 调用点加 `await`（`ContextComposer` 与测试）。
