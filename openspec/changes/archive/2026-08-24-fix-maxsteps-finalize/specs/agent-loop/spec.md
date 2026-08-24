## MODIFIED Requirements

### Requirement: 终止条件

循环 SHALL 在「模型返回无 tool_calls」或「步数达到 maxSteps」时终止；当因 maxSteps（或超时预算）退出、且最后一条 assistant 消息仍带 `tool_calls` 时，SHALL 追加一轮「不带工具」的总结调用，强制模型纯文本给出最终结论。

#### Scenario: 自然终止

- **WHEN** 模型返回不含 tool_calls 的消息
- **THEN** 循环结束，返回该消息

#### Scenario: 步数上限兜底

- **WHEN** 循环步数达到 maxSteps（默认 10）且最后消息无 tool_calls
- **THEN** 循环强制终止，返回当前状态

#### Scenario: 预算兜底强制总结

- **WHEN** 循环因 maxSteps 退出且最后消息仍带 tool_calls
- **THEN** 追加一轮不带工具的总结调用，最终结果是不含 tool_calls 的纯文本结论，steps 计数 +1
