# capability-retrieval Specification

## Purpose

TBD - created by archiving change add-capability-retrieval. Update Purpose after archive.

## Requirements

### Requirement: CapabilityRegistry 统一 meta

系统 SHALL 提供 `CapabilityRegistry`，支持 `register`（注册 meta：`id` / `type` / `description` / `tags`），按 type 区分能力类型。

#### Scenario: 注册与区分类型

- **WHEN** 注册一个 `type='rule'` 的 meta
- **THEN** 该 meta 被纳入索引，可按 type 过滤

### Requirement: BM25 检索

系统 SHALL 提供 `retrieve(query, topK)`，用 minisearch + Intl.Segmenter 分词对 meta（description + tags）打分，返回 top-k 候选（含 `score`）。

#### Scenario: 关键词召回

- **WHEN** 以「Vue 组件怎么写」检索，存在 description 含「Vue3 TypeScript 编码规范」的 rule
- **THEN** 该 rule 被召回且 score 较高

#### Scenario: 输出得分

- **WHEN** 检索返回候选
- **THEN** 每项含 `score`，可用于可观测排查

### Requirement: rules 按需加载

系统 SHALL 提供 `loadRulesText(rules, loader, query, topK)`：`always` 规则的 content 全部注入 + `on-demand` 规则经 `CapabilityLoader` BM25 召回 top-k 的 content，去重拼接，输出「本次注入的规则文本」。

#### Scenario: always 规则强制注入

- **WHEN** 存在 `kind='always'` 的规则
- **THEN** 其 content 无条件包含在输出文本中

#### Scenario: on-demand 规则按需召回

- **WHEN** 存在 `kind='on-demand'` 的规则且与 query 相关
- **THEN** 其 content 经 BM25 召回后注入；不相关的规则不注入

### Requirement: C1 空集合兜底

当检索无候选时，系统 SHALL 返回空文本（不注入规则），不报错。

#### Scenario: 无匹配规则

- **WHEN** 所有 on-demand 规则均与 query 不相关
- **THEN** 输出为空文本，流程正常继续

### Requirement: CapabilityLoader 统一加载

系统 SHALL 提供 `CapabilityLoader<T>`，接收能力记录（含 `id` / `description` / `tags`）与 `type`，统一注册进 `CapabilityRegistry` 并按 query BM25 检索，返回命中的记录（含 `score`）。

#### Scenario: 注册与检索

- **WHEN** 以 `type='rule'` 构造 `CapabilityLoader` 并注册若干记录
- **THEN** `loadForQuery` 返回命中的 `{ record, score }` 列表

#### Scenario: 按 type 过滤

- **WHEN** 注册表混有 rule / skill 记录
- **THEN** `CapabilityLoader('rule')` 的 `loadForQuery` 只返回 `type='rule'` 的记录

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

系统 SHALL 定义 `Retriever` 接口（`name`、`retrieve(query, topK): Promise<RetrievalCandidate[]>`，`RetrievalCandidate = { id, score, payload? }`）与 `Reranker` 接口（`name`、`rerank(query, candidates): Promise<RetrievalCandidate[]>`），并提供默认实现 `Bm25Retriever`（复用 `CapabilityRegistry`）与 `IdentityReranker`（保持原序原分）。二者经 `PluginContext.registerRetriever` / `registerReranker` 注入，装配层取插件注册的实例（缺省回退默认），随 `ResolvedAgent.retriever` / `reranker` 暴露。

#### Scenario: BM25 检索

- **WHEN** `Bm25Retriever` 绑定含能力 meta 的 `CapabilityRegistry` 后 `retrieve(query, topK)`
- **THEN** 返回带 `score` 的候选（含 `payload` 为 meta）

#### Scenario: 恒等重排

- **WHEN** `IdentityReranker` 重排候选
- **THEN** 保持原序原分返回

#### Scenario: 插件注入

- **WHEN** 一个 plugin 经 `registerReranker` 注入自定义重排器
- **THEN** `ResolvedAgent.reranker` 为插件实例；未注入时为 `IdentityReranker`
