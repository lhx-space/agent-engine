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

系统 SHALL 将模型的 `tool_calls` 派发给 ToolRegistry 执行，并把结果作为 `role=tool` 消息回填上下文。当模型一次返回多个 `tool_calls` 时，guardrail `beforeToolCall` SHALL 按序逐个校验（可逐个阻断），校验通过的工具 SHALL 并发执行（`Promise.allSettled`），结果按原 tool_call 顺序回填；单个工具失败不阻塞其他工具，失败工具的 `Error:` 作为其 tool 结果回填。

#### Scenario: 工具结果回填

- **WHEN** 模型返回一个 `tool_call`（如 `get_weather`）
- **THEN** 对应工具被 ToolRegistry 执行，结果作为 tool 消息（含 `toolCallId`）追加到 messages

#### Scenario: 多个工具调用并发执行

- **WHEN** 模型一次返回多个 tool_calls
- **THEN** 各工具并发执行，结果按原顺序回填；单个失败不影响其余

#### Scenario: 单个工具失败不阻塞其他

- **WHEN** 并发执行中某个工具抛错
- **THEN** 该工具结果回填 `Error:`，其余工具结果正常回填，循环继续

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

系统 SHALL 支持在 `AgentLoop` 注入 `ConversationMemory`（`memory` 选项，可选）；`run` 时经 `await memory.getWindow()` 取回「裁剪 + 摘要后」的历史窗口并拼进 messages（system + 窗口 + 当前 user），正常结束时把本轮消息（system 之外）写回 memory；异常时保持 memory 不变。

#### Scenario: 跨 run 累积历史

- **WHEN** 注入 memory 并连续 run 两次
- **THEN** 第二次 run 的 LLM 调用携带第一次 run 的历史消息

#### Scenario: 历史经 getWindow 取回

- **WHEN** 注入带 token 预算/摘要的 `ConversationMemory` 并 `run`
- **THEN** 构造 LLM 入参的历史来自 `getWindow()`（含摘要头），而非原始全量历史

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

`AgentLoop.run(userInput, options?)` SHALL 支持可选 `onEvent` 回调，产出结构化事件：`step_start` / `llm_delta` / `tool_call` / `tool_result` / `hook` / `done` / `error`；`llm_delta` 事件 SHALL 含可选 `kind`（`reasoning` / `content`，缺省 `content`）区分思考/回复增量。

#### Scenario: 逐步事件

- **WHEN** 一个 run 经历 1 次 LLM 调用 + 1 次工具调用
- **THEN** 依次产出 step_start → hook/tool_call → tool_result → done（事件顺序稳定）

#### Scenario: 流式文本增量

- **WHEN** provider 支持流式且提供 onEvent
- **THEN** 文本经多次 `llm_delta` 事件逐步产出

#### Scenario: 思考与回复分开事件

- **WHEN** provider 的 onDelta 以 `kind='reasoning'` / `kind='content'` 回调
- **THEN** 对应 `llm_delta` 事件携带相同 `kind`

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

### Requirement: 工具执行重试

系统 SHALL 支持可配置的工具执行重试：当工具执行抛错时，按 `execution.toolRetry`（`maxRetries` / `baseDelayMs`）进行指数退避重试，`maxRetries` 默认 0（不重试，向后兼容）；重试耗尽仍失败 SHALL 回填 `Error:`；guardrail 阻断不参与重试。

#### Scenario: 默认不重试

- **WHEN** 未配置 `execution.toolRetry.maxRetries`（或为 0）
- **THEN** 工具抛错直接回填 `Error:`，不重试

#### Scenario: 配置后重试成功

- **WHEN** `maxRetries=2` 且工具前两次抛错、第三次成功
- **THEN** 最终结果为成功输出，回填正常

#### Scenario: 重试耗尽回填错误

- **WHEN** `maxRetries=2` 且工具三次都抛错
- **THEN** 回填 `Error:`，循环继续

### Requirement: 流式取消（AbortSignal）

`AgentLoop.run(userInput, options?)` SHALL 支持 `options.signal`（`AbortSignal`）：每轮 LLM 调用前检查 `signal.aborted`，已中止则抛出 `AbortError`；中止 SHALL 不回写 memory、不按普通错误触发 `onError(phase='agent-loop')`，向上抛 `AbortError`。

#### Scenario: 中止抛出 AbortError

- **WHEN** 传入已 `aborted` 的 `signal` 并运行
- **THEN** 抛出 `AbortError`，memory 保持原历史不变

#### Scenario: 中止不回写 memory

- **WHEN** run 过程中 signal 被中止
- **THEN** 本轮消息不回写 memory，历史保持不变

### Requirement: finishReason 区分与续写

`AgentLoop` SHALL 区分 `finishReason`：`stop` 自然终止、`tool_calls` 继续循环、`length`（max_tokens 截断）在 `continuations < execution.maxContinuations`（默认 1）且未达 `maxSteps` 时，追加一条 user「继续」消息进入下一轮；最终结果 SHALL 携带 `finishReason`。

#### Scenario: length 截断自动续写

- **WHEN** 模型返回 `finishReason='length'` 且未超 `maxContinuations` / `maxSteps`
- **THEN** 追加 user 继续消息，循环继续，续写计数 +1

#### Scenario: 续写次数耗尽终止

- **WHEN** `finishReason='length'` 但续写已达 `maxContinuations`
- **THEN** 终止并返回当前消息，结果 `finishReason` 为 `length`

#### Scenario: 结果携带 finishReason

- **WHEN** 循环终止
- **THEN** `AgentLoopResult` 含 `finishReason`（`stop` / `length` / 其他）

### Requirement: execution 预算

`AgentLoop` SHALL 按 `execution` 配置约束运行预算：`maxSteps`（默认 10）限制循环步数、`maxToolCalls`（默认无限制）限制工具调用总数、`timeoutMs`（默认无限制）限制整体耗时；超限 SHALL 终止循环并返回当前状态。

#### Scenario: maxSteps 可配置

- **WHEN** 配置 `execution.maxSteps=3` 且循环未自然终止
- **THEN** 第 3 步后强制终止，返回当前状态

#### Scenario: maxToolCalls 超限

- **WHEN** 配置 `execution.maxToolCalls=2` 且模型持续发起工具调用
- **THEN** 工具调用总数达 2 后终止循环

#### Scenario: 缺省对齐现状

- **WHEN** 未配置 `execution`
- **THEN** 行为与现状一致（`maxSteps=10`、无工具调用/耗时上限）

### Requirement: 会话边界

`AgentLoop` SHALL 维护会话边界：首次 `run` 前触发 `onSessionStart`（幂等，仅一次）；`endSession()` 或 `dispose` 时触发 `onSessionEnd`（幂等）并清空会话记忆；未注入 hooks 时跳过。

#### Scenario: 首次 run 触发 onSessionStart

- **WHEN** 注入含 `onSessionStart` 的 hook 并首次 `run`
- **THEN** `onSessionStart` 触发一次，后续 `run` 不再触发

#### Scenario: endSession 触发 onSessionEnd

- **WHEN** 调用 `endSession()`
- **THEN** `onSessionEnd` 触发一次，memory 清空

#### Scenario: 幂等

- **WHEN** 多次调用 `endSession()`
- **THEN** `onSessionEnd` 仅触发一次，无副作用

### Requirement: 流式自定义事件

系统 SHALL 在 `AgentRunEvent` 提供 `{ type:'custom'; name; data? }` 变体；当 `AgentLoop` 注入了 `eventBus`，`run` 期间 SHALL 把事件总线的 `custom` 事件转发到 `onEvent`（run 结束含异常时退订）。

#### Scenario: 自定义事件转发

- **WHEN** `AgentLoop` 注入事件总线并 `run`，期间总线 `emit({ type:'custom', name, data })`
- **THEN** `onEvent` 收到 `{ type:'custom', name, data }`

### Requirement: Human-in-the-loop 审批

系统 SHALL 提供 `AgentRunOptions.approveToolCall(name, args): Promise<ToolApproval>`；循环在工具「guardrail 放行后、执行前」顺序 await 审批，`approved:false` 时阻断执行并把 `reason ?? 'Rejected by human'` 回填为工具结果（含 toolCallId 配对）。

#### Scenario: 拒绝阻断

- **WHEN** `approveToolCall` 返回 `{ approved:false, reason }`
- **THEN** 工具不执行，结果回填含 `reason` 的阻断文本，模型可据此调整

#### Scenario: 放行执行

- **WHEN** `approveToolCall` 返回 `{ approved:true }`
- **THEN** 工具正常执行，结果回填

### Requirement: 长期记忆召回与写回

Agent Loop SHALL 支持注入 `longTermMemory`（可选）；每次 `run` 开始时经 `recall(userInput)` 召回相关长期记忆，非空时作为 `[长期记忆]` 片段注入 system prompt；正常结束时把本轮（用户输入 + 最终答案）经 `remember` 写回。异常路径 SHALL 不写回。

#### Scenario: 召回注入

- **WHEN** 注入 `longTermMemory` 且 `recall` 返回非空
- **THEN** 构造 LLM 入参的 system prompt 含 `[长期记忆]` 片段与召回文本

#### Scenario: 正常结束写回

- **WHEN** 注入 `longTermMemory` 且 `run` 正常结束
- **THEN** `remember` 被调用一次（用户输入 + 最终答案）

#### Scenario: 异常不写回

- **WHEN** `run` 抛错
- **THEN** `remember` 不被调用
