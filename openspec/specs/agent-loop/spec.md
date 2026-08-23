# agent-loop Specification

## Purpose

TBD - created by archiving change add-agent-loop. Update Purpose after archive.

## Requirements

### Requirement: ReAct 循环执行

系统 SHALL 提供 `AgentLoop`，注入 LLM Provider、ToolRegistry 与 systemPrompt 后，调用 `run(userInput)` 驱动循环：组装 system + user 消息 → 调用模型 → 依据返回决定继续或终止。

#### Scenario: 单轮直接回答

- **WHEN** 模型对用户输入直接返回文本（无 tool_calls）
- **THEN** 循环终止并返回该文本作为最终结果

#### Scenario: 多轮工具循环

- **WHEN** 模型返回 tool_calls 后，工具结果回填，模型再次被调用
- **THEN** 循环持续直至模型返回无 tool_calls 的最终回答

### Requirement: 工具派发与结果回填

系统 SHALL 将模型的 `tool_calls` 逐个派发给 ToolRegistry 执行，并把结果作为 `role=tool` 消息回填上下文。

#### Scenario: 工具结果回填

- **WHEN** 模型返回一个 `tool_call`（如 `get_weather`）
- **THEN** 对应工具被 ToolRegistry 执行，结果作为 tool 消息（含 `toolCallId`）追加到 messages

#### Scenario: 多个工具调用顺序执行

- **WHEN** 模型一次返回多个 tool_calls
- **THEN** 按返回顺序逐个执行并逐个回填

### Requirement: 终止条件

循环 SHALL 在「模型返回无 tool_calls」或「步数达到 maxSteps」时终止。

#### Scenario: 自然终止

- **WHEN** 模型返回不含 tool_calls 的消息
- **THEN** 循环结束，返回该消息

#### Scenario: 步数上限兜底

- **WHEN** 循环步数达到 maxSteps（默认 10）
- **THEN** 循环强制终止，返回当前状态

### Requirement: 最终结果

`run` SHALL 返回包含最终消息、完整消息序列与步数的结果对象。

#### Scenario: 结果结构

- **WHEN** 循环终止
- **THEN** 结果含 `finalMessage`（最终 assistant 消息）、`messages`（完整序列）、`steps`（执行步数）

### Requirement: hooks 调用点

系统 SHALL 在 beforeLLM / afterLLM / beforeToolCall / afterToolCall 四个节点调用注入的 hooks；未注入时跳过。

#### Scenario: hooks 被调用

- **WHEN** 注入自定义 hooks 并运行循环
- **THEN** 对应节点的 hook 方法被按序调用

#### Scenario: 未注入 hooks 不报错

- **WHEN** 不注入任何 hooks 并运行循环
- **THEN** 循环正常执行，不因 hooks 缺失报错

### Requirement: 工具执行错误处理

工具执行抛错 SHALL 将错误信息作为 tool 消息回填（而非终止循环）。

#### Scenario: 工具失败回填错误

- **WHEN** 某工具执行抛错
- **THEN** 错误信息作为 tool 消息回填，循环继续，由模型决定下一步
