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

### Requirement: 动态 systemPrompt

系统 SHALL 支持 `systemPrompt` 为静态字符串、模板对象（`SystemPrompt`）或函数式；每次 `run` 动态解析后，rules / skills 检索文本 SHALL 兜底追加到最终 system prompt（字符串 / 函数式形态同样生效，不静默丢弃）。

#### Scenario: 静态 systemPrompt 追加 rules

- **WHEN** 注入字符串 `systemPrompt` 且提供 `rules`
- **THEN** 最终 system 消息内容 = 原字符串 + 兜底追加的 rules 文本

#### Scenario: 函数式 systemPrompt 追加 rules

- **WHEN** 注入函数式 `systemPrompt` 且提供 `rules`
- **THEN** 函数返回值后兜底追加 rules 文本

#### Scenario: 模板对象不变

- **WHEN** `systemPrompt` 为模板对象
- **THEN** 仍经 `buildSystemPrompt` 渲染变量并注入 rules/skills（行为不变）

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

### Requirement: 会话记忆集成

系统 SHALL 支持在 `AgentLoop` 注入 `ConversationMemory`（`memory` 选项，可选）；`run` 时把历史消息拼进 messages（system + 历史 + 当前 user），正常结束时把本轮消息（system 之外）写回 memory；异常时保持 memory 不变。

#### Scenario: 跨 run 累积历史

- **WHEN** 注入 memory 并连续 run 两次
- **THEN** 第二次 run 的 LLM 调用携带第一次 run 的历史消息

#### Scenario: 未注入 memory

- **WHEN** 不注入 memory
- **THEN** 行为与以往一致，无历史累积

#### Scenario: 异常不回写

- **WHEN** run 过程中抛错
- **THEN** memory 保持原历史不变

### Requirement: 内建规则检索注入

系统 SHALL 支持 `systemPrompt` 为模板对象（`SystemPrompt`）并配合 `rules`（上下文规则）在每次 `run` 自动完成「检索 → 注入」：模板经变量渲染，`rules` 经 `RuleLoader` 按 userInput 检索后注入；guardrail 注册表字段 SHALL 命名为 `guardrails`，与上下文规则 `rules` 分离。

#### Scenario: 模板对象 + rules 自动检索

- **WHEN** `systemPrompt` 为模板对象且提供 `rules`（含 always 与 on-demand）
- **THEN** 每次 run 渲染模板变量，并注入 always 规则与 BM25 召回的相关 on-demand 规则

#### Scenario: 模板对象无 rules

- **WHEN** `systemPrompt` 为模板对象但未提供 `rules`
- **THEN** 仅渲染模板变量，不注入规则

#### Scenario: guardrails 与 rules 分离

- **WHEN** 注入 guardrail 注册表与上下文规则
- **THEN** guardrail 走 `guardrails` 字段，上下文规则走 `rules` 字段，互不干扰

### Requirement: skill 集成

系统 SHALL 支持 `AgentLoop` 注入 `skills?: Skill[]`；每次 `run` 经 `SkillLoader` 检索命中的 skills，将其指令注入 system prompt，并将其捆绑工具注册进 ToolRegistry；`run` 结束时（含异常）SHALL 清理本轮注册的 skill 工具（还原被覆盖的同名工具），避免跨 run 残留、工具面膨胀。

#### Scenario: 命中 skill 注入指令并注册工具

- **WHEN** 注入 skills 且 query 命中某 skill（含捆绑工具）
- **THEN** 该 skill 的 instruction 进入 system prompt，其捆绑工具在 LLM 调用前注册进 ToolRegistry

#### Scenario: run 结束清理 skill 工具

- **WHEN** 某次 run 注册了 skill 捆绑工具
- **THEN** run 结束（含异常）后，该工具从 ToolRegistry 移除；若覆盖了同名已有工具则还原

#### Scenario: 未命中不注入

- **WHEN** query 与所有 skill 均不相关
- **THEN** 无 skill 指令注入，无额外工具注册

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
