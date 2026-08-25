## ADDED Requirements

### Requirement: 语义召回长期记忆（LongTermMemory / SemanticMemory）

系统 SHALL 定义 `LongTermMemory` 接口（`remember(text)` / `recall(query, topK?)` → 召回文本数组）与 `SemanticMemory` 默认实现：`remember` 经 `EmbeddingProvider` 向量化后写入 `VectorStore`（携带原文 metadata）并持久化到 `MemoryBackend`；`recall` 向量化 query 后 `VectorStore.query` 召回 top-k、返回原文。当未配置 `EmbeddingProvider` 时，`remember` / `recall` SHALL 静默 no-op（不抛错）。

#### Scenario: 召回相关记忆

- **WHEN** `remember('用户偏好蓝色')` 后 `recall('喜欢什么颜色', 3)`
- **THEN** 返回包含「用户偏好蓝色」的召回文本

#### Scenario: 无 embedding no-op

- **WHEN** `SemanticMemory` 未注入 `EmbeddingProvider` 时 `remember` / `recall`
- **THEN** 不抛错，`recall` 返回空数组，`remember` 不写入
