## ADDED Requirements

### Requirement: 运行时事件流

`AgentLoop.run(userInput, options?)` SHALL 支持可选 `onEvent` 回调，产出结构化事件：`step_start` / `llm_delta` / `tool_call` / `tool_result` / `hook` / `done` / `error`。

#### Scenario: 逐步事件

- **WHEN** 一个 run 经历 1 次 LLM 调用 + 1 次工具调用
- **THEN** 依次产出 step_start → hook/tool_call → tool_result → done（事件顺序稳定）

#### Scenario: 流式文本增量

- **WHEN** provider 支持流式且提供 onEvent
- **THEN** 文本经多次 `llm_delta` 事件逐步产出

#### Scenario: 兼容无 onEvent

- **WHEN** 不传 `onEvent`
- **THEN** run 行为与非流式一致，返回 `AgentLoopResult`
