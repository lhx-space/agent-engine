## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: CapabilityRegistry 统一 meta

### Requirement: BM25 检索

### Requirement: CapabilityLoader 统一加载

### Requirement: 能力检索语义化（BM25 + 向量 RRF 融合）
