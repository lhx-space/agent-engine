## Context

文档检索当前是纯 BM25（`DocumentIndex` 内嵌 MiniSearch）。`EmbeddingProvider`（openai-compatible，含维度推断）与 `VectorStore`（`InMemoryVectorStore`）已就位，且 `SemanticMemory` 已在用「embedding + vector store」做长期记忆召回。本变更把同一套能力复用到文档检索，做混合召回。

## Goals / Non-Goals

**Goals:** RRF 通用原语；`DocumentIndex` 混合检索（BM25 + 向量）；`embedding` 配置自动启用语义召回；无 embedding 时优雅回落 BM25。

**Non-Goals:** 文档向量库后端注入（pgvector）；rules/skills 能力检索的 RRF 升级（`capability-retrieval`）；动态 k / reranker；增量索引。

## Decisions

- **D1 RRF 通用原语**：`retrieval/rrf.ts` 导出 `reciprocalRankFusion(lists, k=60)`，输入已排名的候选列表，输出按 RRF 分融合排序（`Σ 1/(k+rank+1)`）；文档检索首个消费，未来能力检索 RRF 复用。
- **D2 `DocumentIndex` 混合检索**：构造可选 `{ topK?, embedding?, vectorStore? }`；`embedding` 存在时 `addChunks` 对每个 chunk 向量化入库（`VectorStore` 记录 id 复用 chunk id），`retrieve` 双路召回 + RRF 融合。
- **D3 async 签名**：向量化/查询为异步，`addChunks`/`retrieve` 由同步转 async；`ContextComposer.compose` 本就 async，`await retrieve` 无结构改动。
- **D4 默认向量库**：`embedding` 存在且未注入 `vectorStore` 时，`DocumentIndex` 内部建 `InMemoryVectorStore`（文档自有向量索引，不与长期记忆共享）。
- **D5 装配时序**：`resolveAgentConfig` 在 `loadDocuments` 前先 `createEmbeddingProvider(config.embedding)`，把同一 provider 传给 `loadDocuments` 与 `assembleAgentLoop`。插件注册的 embedding/vectorStore 在 `assembleAgentLoop` 内解析，故文档装载阶段不可见（v1 限制，见 Risks）。
- **D6 超采 + 截断**：双路各召回 `topK * 2`，RRF 融合后取 top-k；无 embedding 时直接 BM25 top-k（行为与现状一致）。

## Risks / Trade-offs

- [插件 embedding 不可用于文档装载] → 文档语义召回仅由 `config.embedding` 驱动；插件注入需后续把 vector/embedding 解析前移到装配前。
- [冷启动 embedding 成本] → 每个 chunk 一次 embed 调用，大批量文档装载变慢；属预期，BM25 兜底路径不受影响。
- [签名破坏] → `addChunks`/`retrieve` 转 async，需同步更新现有调用与测试（v0.1 内部 API，无外部兼容负担）。

## Migration Plan

- `DocumentIndex` 构造由 `new DocumentIndex(2)` 改为 `new DocumentIndex({ topK: 2 })`；调用点（`loadDocuments` / 测试）同步更新。
- `retrieve` 返回仍为 `Chunk[]`（`ContextComposer` 只拼文本），融合仅影响召回顺序。
