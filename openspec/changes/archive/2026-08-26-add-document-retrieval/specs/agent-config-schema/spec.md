## ADDED Requirements

### Requirement: documents 配置轴

`AgentConfig` SHALL 提供可选 `documents` 配置：`sources`（路径数组，文件或目录）、`chunking`（`strategy: fixed | heading`、`size`、`overlap`）、`topK`（检索数量，默认 4）。

#### Scenario: 声明文档源

- **WHEN** 配置含 `documents.sources: ['./knowledge']`
- **THEN** 装配时装载该目录文档并建立索引
