## ADDED Requirements

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
