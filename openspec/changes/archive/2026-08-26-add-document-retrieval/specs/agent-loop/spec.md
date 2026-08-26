## ADDED Requirements

### Requirement: 文档检索注入

系统 SHALL 在 run 时用 userInput 从 `DocumentIndex` 检索 top-k 文档片段，并以 `[文档]` 片段注入 system prompt（与 `[长期记忆]` 同级）。

#### Scenario: 注入命中片段

- **WHEN** Agent 装配了含相关文档的 `DocumentIndex` 且 userInput 命中
- **THEN** system prompt 含 `[文档]` 片段与命中文本
