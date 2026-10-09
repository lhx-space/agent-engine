## MODIFIED Requirements

### Requirement: SemanticMemory 实现 LongTermMemory

`remember` SHALL 在写入向量时携带 `namespace`（由装配层按 agent 注入）、`kind='memory'`、`content`（记忆原文）与 `embedding_model`（取自 `EmbeddingProvider.name`），并继续持久化到 `MemoryBackend` 以保证 KV 侧可查。

`recall` SHALL 通过一次向量查询直接取得原文（`content` 列），**不再**执行「向量查询 → 回 `MemoryBackend` 取原文」的二次读取；并按 `namespace` 与 `embedding_model` 过滤，避免跨 agent 与跨模型的记忆混入。

未注入 `EmbeddingProvider` 时仍 SHALL 静默 no-op。

#### Scenario: 召回一次查询出结果

- **WHEN** `remember('用户偏好蓝色')` 后 `recall('喜欢什么颜色', 3)`
- **THEN** 返回包含「用户偏好蓝色」的召回文本，且整个过程只对向量存储查询一次

#### Scenario: 跨 agent 记忆隔离

- **WHEN** agent A 与 agent B 在同一库各写入记忆，agent A 执行 `recall`
- **THEN** 结果仅含 agent A 的记忆

#### Scenario: 换 embedding 模型后旧记忆不被误召回

- **WHEN** 库中存在以旧模型写入的向量，当前配置使用新模型
- **THEN** 召回按 `embedding_model` 过滤，旧模型向量不参与检索

#### Scenario: 无 embedding no-op

- **WHEN** `SemanticMemory` 未注入 `EmbeddingProvider` 时 `remember` / `recall`
- **THEN** 不抛错，`recall` 返回空数组，`remember` 不写入
