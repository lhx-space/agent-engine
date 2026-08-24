## ADDED Requirements

### Requirement: 工具入参规范化

`AgentLoop` SHALL 在执行工具前，把 `toolCall.function.arguments` 规范化为合法 JSON（空 / 空白 / 非法 JSON → `{}`），并写回 `toolCall`，使回填历史的消息入参始终合法。

#### Scenario: 空参数兜底

- **WHEN** 模型返回 `arguments: ""` 的工具调用
- **THEN** 执行入参为 `{}`，历史消息中该 tool_call 的 arguments 为 `{}`，不抛 invalid JSON

#### Scenario: 非法 JSON 兜底

- **WHEN** 模型返回无法 `JSON.parse` 的 arguments
- **THEN** 兜底为 `{}`，交由工具 inputSchema 校验报错

#### Scenario: 合法参数原样

- **WHEN** 模型返回合法 JSON arguments
- **THEN** 入参与历史保持原值
