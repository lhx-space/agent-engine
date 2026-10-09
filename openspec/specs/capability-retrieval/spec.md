# capability-retrieval Specification

## Purpose

TBD - created by archiving change add-capability-retrieval. Update Purpose after archive.

## Requirements

### Requirement: 语义检索后端（VectorStore + EmbeddingProvider）

`VectorStore` 的写入记录 SHALL 支持携带 `namespace`（隔离域）、`kind`（资产类型：memory / document / skill）、`refId`（指向来源记录）与 `content`（原文）；`query` SHALL 接受可选 `filter`（`namespace` / `kind`）用于按隔离域与类型过滤。所有新增字段 SHALL 为可选，不传时行为与现状一致。

`EmbeddingProvider` SHALL 暴露其产出的向量维度（`dimension`）与模型标识（`name`），供存储层在建表与写入校验时使用。

#### Scenario: 按命名空间隔离检索

- **WHEN** 以 `namespace='devops-agent:memory'` 写入向量，再以同 namespace 查询
- **THEN** 仅返回该 namespace 下的向量，其他 agent 的向量不出现在结果中

#### Scenario: 不传 filter 时向后兼容

- **WHEN** 调用 `query(vector, topK)` 不传第三参数
- **THEN** 行为与变更前一致（全量检索），不报错

#### Scenario: 维度不符显式报错

- **WHEN** 向声明为 `vector(1024)` 的表写入长度为 1536 的向量
- **THEN** 抛出明确错误（含期望维度与实际维度），不得静默写入

#### Scenario: 召回直接得到原文

- **WHEN** 写入时带 `content`，随后查询
- **THEN** 返回的匹配项直接包含原文，无需二次查询其他存储

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
