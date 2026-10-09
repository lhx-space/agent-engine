## MODIFIED Requirements

### Requirement: documents 能力外放

文档索引在写入向量时 SHALL 携带装配层注入的 `namespace` 与 `kind='document'`，使文档向量与同库的其他 agent / 其他资产类型（记忆、技能）隔离；检索时 SHALL 按相同 `namespace` 与 `kind` 过滤。

未提供 `EmbeddingProvider` 时仍 SHALL 退化为纯 BM25 词法检索，不写入任何向量。

#### Scenario: 文档向量按 agent 隔离

- **WHEN** agent A 与 agent B 各自装载文档到同一库，agent A 检索
- **THEN** 仅召回 agent A 的文档 chunk

#### Scenario: 文档与记忆互不干扰

- **WHEN** 同一 namespace 下同时存在 `kind='document'` 与 `kind='memory'` 的向量
- **THEN** 文档检索只返回 `kind='document'` 的结果

#### Scenario: 无 embedding 退化

- **WHEN** 未注入 `EmbeddingProvider` 时装载并检索文档
- **THEN** 走 BM25 检索且不写入向量，行为与变更前一致
