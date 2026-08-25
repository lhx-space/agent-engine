## ADDED Requirements

### Requirement: memory.session 配置轴

系统 SHALL 定义 `memory.session` 子 Schema，含 `maxMessages`（int positive，可选）、`maxTokens`（int positive，可选，token 预算）、`summary`（boolean，默认 false，滚动摘要开关）；`summary` 未声明时 SHALL 默认为 false。

#### Scenario: 缺省不开摘要

- **WHEN** 配置声明 `memory: { session: { maxTokens: 4096 } }`
- **THEN** 解析后 `summary` 为 false、`maxTokens` 为 4096

#### Scenario: 显式开启摘要

- **WHEN** 配置声明 `memory: { session: { summary: true } }`
- **THEN** 解析后 `summary` 为 true
