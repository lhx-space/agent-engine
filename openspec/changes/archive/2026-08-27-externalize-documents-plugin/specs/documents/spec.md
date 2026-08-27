## REMOVED Requirements

### Requirement: 文档归一化层

### Requirement: 分块

### Requirement: 文档索引与装载

### Requirement: 二进制文档归一化器

### Requirement: 文档混合检索（BM25 + 向量 RRF 融合）

## ADDED Requirements

### Requirement: documents 能力外放

documents 能力（归一化 / 分块 / 索引装载 / 二进制归一化 / 混合检索）SHALL 已外放为 `@agent-engine/plugin-documents`；core SHALL 不再持有 documents 能力实现，只经 `ContextContributor` 统一缝接收其注入的 `[文档]` 文本。

#### Scenario: 经 plugin-documents 注入

- **WHEN** 装配 `@agent-engine/plugin-documents` 并运行，检索命中文档 chunk
- **THEN** 该 chunk 文本经 `ContextContributor` 注入 system prompt，core 无 document 硬路径
