## ADDED Requirements

### Requirement: createEmbeddingProvider 工厂

系统 SHALL 提供 `createEmbeddingProvider(config)` 工厂，把 `EmbeddingConfig` 解析为 `EmbeddingProvider`：对 openai-compatible `/embeddings` 端点（POST `{ model, input: string[] }`，`Authorization: Bearer {apiKey}`）复用 `FetchLike`；`embed(texts)` 返回与入参等长的向量数组，`dimension` 取配置值或首个响应向量长度。

#### Scenario: embed 一批文本

- **WHEN** 以 mock fetch 构造 provider 并 `embed(['a', 'b'])`
- **THEN** 请求 `/embeddings`（含 model 与 input），返回两条等长向量

#### Scenario: dimension 推断

- **WHEN** 配置未给 `dimension`
- **THEN** `dimension` 取首次响应向量长度
