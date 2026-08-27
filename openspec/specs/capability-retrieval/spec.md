# capability-retrieval Specification

## Purpose

TBD - created by archiving change add-capability-retrieval. Update Purpose after archive.

## Requirements

### Requirement: 语义检索后端（VectorStore + EmbeddingProvider）

系统 SHALL 定义 `VectorStore` 接口（`name`、`add(records)`、`query(vector, topK)`、`delete(ids)`、`clear()`）与 `EmbeddingProvider` 接口（`name`、`dimension`、`embed(texts)`），并提供 `InMemoryVectorStore`（暴力余弦相似度，`name` 为 `in-memory`）作为开发默认；`EmbeddingProvider` 无内置默认（需真实向量模型）。二者经 `PluginContext.registerVectorStore` / `registerEmbeddingProvider` 注入，装配层取首个注册的 `VectorStore`（缺省回退 `InMemoryVectorStore`）与首个注册的 `EmbeddingProvider`（可缺省为 `undefined`），随 `ResolvedAgent.vectorStore` / `ResolvedAgent.embeddingProvider` 暴露。

#### Scenario: in-memory 向量召回

- **WHEN** 以 `InMemoryVectorStore` 添加若干向量记录后 `query` 某向量
- **THEN** 返回按余弦相似度降序的 top-k 匹配（含 `score`）

#### Scenario: 删除与清空

- **WHEN** `delete` 若干 id 或 `clear`
- **THEN** 对应记录不再被召回，`clear` 后全部清空

#### Scenario: embedding 经插件注入

- **WHEN** 一个 plugin 经 `registerEmbeddingProvider` 注册 embedding
- **THEN** `ResolvedAgent.embeddingProvider` 为注册实例；未注册时为 `undefined`

### Requirement: 检索策略接口（Retriever / Reranker）

系统 SHALL 定义 `Retriever` 接口（`name`、`retrieve(query, topK): Promise<RetrievalCandidate[]>`，`RetrievalCandidate = { id, score, payload? }`）与 `Reranker` 接口（`name`、`rerank(query, candidates): Promise<RetrievalCandidate[]>`）；默认实现为 `noopRetriever`（返回空候选）与 `IdentityReranker`（保持原序原分）。二者经 `PluginContext.registerRetriever` / `registerReranker` 注入，装配层取插件注册的实例（缺省回退默认），随 `ResolvedAgent.retriever` / `reranker` 暴露。

#### Scenario: 无注入时 noop 默认

- **WHEN** 无插件注册自定义 `Retriever` 时装配
- **THEN** `ResolvedAgent.retriever.name` 为 `none`，`retrieve` 返回空候选

#### Scenario: 恒等重排

- **WHEN** `IdentityReranker` 重排候选
- **THEN** 保持原序原分返回

#### Scenario: 插件注入

- **WHEN** 一个 plugin 经 `registerReranker` 注入自定义重排器
- **THEN** `ResolvedAgent.reranker` 为插件实例；未注入时为 `IdentityReranker`

### Requirement: 统一混合检索原语

系统 SHALL 提供 `hybridRetrieve(query, topK, { embedding, vectorStore, lexical, ensureVectors? })`，作为「词法（BM25）+ 语义（向量）双路召回 → RRF 融合」的唯一实现；语义链路任一步失败时 SHALL 回落词法召回结果。`CapabilityRegistry.retrieve` 与 `DocumentIndex.retrieve` SHALL 委托该原语，各自只提供词法召回回调与结果映射。

#### Scenario: 双路召回与融合

- **WHEN** 以提供 `embedding` + `vectorStore` + `lexical` 回调调用 `hybridRetrieve`
- **THEN** 词法与向量双路召回，RRF 融合后返回 top-k 候选（含 `score`）

#### Scenario: 语义链路失败回落词法

- **WHEN** embedding 调用抛错
- **THEN** `hybridRetrieve` 返回 `lexical(query, topK)` 的候选而不抛错
