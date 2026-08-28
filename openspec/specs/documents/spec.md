# documents Specification

## Purpose

TBD - created by archiving change add-document-normalization. Update Purpose after archive.

## Requirements

### Requirement: documents 能力外放

documents 能力（归一化 / 分块 / 索引装载 / 二进制归一化 / 混合检索）SHALL 已外放为 `@lhx-agent-engine/plugin-documents`；core SHALL 不再持有 documents 能力实现，只经 `ContextContributor` 统一缝接收其注入的 `[文档]` 文本。

#### Scenario: 经 plugin-documents 注入

- **WHEN** 装配 `@lhx-agent-engine/plugin-documents` 并运行，检索命中文档 chunk
- **THEN** 该 chunk 文本经 `ContextContributor` 注入 system prompt，core 无 document 硬路径
