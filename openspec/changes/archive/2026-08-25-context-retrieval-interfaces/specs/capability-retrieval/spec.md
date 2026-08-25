## ADDED Requirements

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
