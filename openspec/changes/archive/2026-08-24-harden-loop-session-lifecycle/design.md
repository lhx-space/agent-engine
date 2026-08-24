## Context

把 `AgentLoop` 从「一次性 demo 循环」升级为「工业级执行循环 + 有生命周期的常驻 Agent」。这是 AGENTS.md M3 剩余项（长期记忆三层 / 多 Agent 编排 / events 总线）的共同前置：没有跨请求的 Agent 生命周期，记忆跨会话与编排都无从谈起。核心约束：**向后兼容**——`execution` 可选、重试默认关闭、`signal` 可选、`sessionId` 可选，老配置与老调用方零改动。

## Goals / Non-Goals

**Goals:**

- 并行执行模型一次返回的多个 `tool_calls`，单工具失败不阻塞其他。
- 工具执行失败可配置重试 + 指数退避（默认关闭）。
- `run` 支持 `AbortSignal` 取消（流式与非流式）。
- `finishReason` 区分 `stop` / `length` / `tool_calls`，`length` 自动续写（可配，默认 1 次）。
- 顶层 `execution` 配置块：`maxSteps` / `maxToolCalls` / `timeoutMs` / `toolRetry` / `maxContinuations`。
- 补齐 3 个会话级 hook（`onInit` / `onSessionStart` / `onSessionEnd`），`HookPoint` 统一 9 个。
- server 层 `sessionId` 复用已装配 Agent（含 memory），TTL / 上限淘汰。

**Non-Goals:**

- 不做长期记忆三层（token 预算 / 滚动摘要 / 语义召回）——那是下一个 change。
- 不做多 Agent 编排 / events 事件总线。
- 不做 token 计数（本次只做「步数/工具调用/耗时」三类预算，token 预算依赖 tokenizer，留长期记忆 change）。
- 不做分布式 session（`SessionStore` 首版 in-memory，抽象接口预留 redis 接入点）。
- 不做工具「依赖图」串行化（LLM 一次返回的 tool_calls 按 OpenAI 语义视为相互独立，并发安全）。

## Decisions

### D1: 并行 tool_calls 用 `Promise.allSettled` + 顺序回填

**选择**：guardrail `beforeToolCall` 仍按序逐个校验（可逐个阻断）；校验通过的工具用 `Promise.allSettled` 并发执行；结果按原 tool_call 顺序回填 messages。

**理由**：OpenAI/Anthropic 语义下，模型一次返回的多个 tool_call 相互独立，并发安全；`allSettled` 保证单个工具抛错不阻塞其他，也不会因一个 reject 丢掉其余结果。顺序回填保证消息序列稳定（后续轮次与 memory 依赖顺序）。guardrail 校验留在并发前，因为它是「阻断」语义，必须逐个、可观测。

### D2: 工具重试默认关闭（`maxRetries=0`），显式开启

**选择**：`execution.toolRetry = { maxRetries: 0, baseDelayMs: 500 }`；仅对「工具执行抛错」重试，指数退避 `baseDelayMs * 2^attempt`，最终失败才回填 `Error:`；guardrail 阻断不重试。

**理由**：默认关闭保证向后兼容（现有测试语义不变）；重试只对「瞬态错误」有意义（网络/超时），确定性错误（如文件不存在）重试无益，但首版不做错误分类，交给配置显式开启。指数退避是社区标准做法。

### D3: 取消用 `AbortSignal` 透传 + loop 层协作式检查

**选择**：`AgentRunOptions.signal?: AbortSignal`；每轮 LLM 调用前检查 `signal?.aborted`，已中止则抛 `AbortError`；openai provider 把 `signal` 透传给 SDK（`baseRequest` 已支持）；anthropic 首版在 provider 层构建请求前检查 aborted。loop 的 catch 识别 `AbortError`：不回写 memory、不按普通错误触发 `onError(phase='agent-loop')`，向上抛 `AbortError`。server 层识别 `AbortError` 不返回 500。

**理由**：`AbortSignal` 是 Web 标准，前端 `fetch`/`AbortController` 天然衔接；openai SDK 原生支持 `signal`，anthropic SDK 首版不依赖其实时取消（loop 每轮前检查即可满足「点停止尽快停」）。AbortError 与业务错误分离，避免把用户取消记成 500。

### D4: `finishReason` 区分 + `length` 自动续写（默认 1 次）

**选择**：识别 `stop`（自然终止）/ `tool_calls`（继续循环）/ `length`（max_tokens 截断）；`length` 且 `continuations < maxContinuations` 且未达 `maxSteps` 时，追加一条 `user` 消息「你上一条回复被截断，请继续未完成的部分」进入下一轮；结果新增 `finishReason` 字段。

**理由**：`length` 截断在长输出/长工具结果下很常见，误判成「回答完」会让回复残缺（Claude Code 对 max_tokens 是自动 continue 的）。默认 1 次 + 预算保护，避免死循环；`maxContinuations` 可配。

### D5: 新增顶层 `execution` 配置块（执行预算/重试/续写）

**选择**：`AgentConfig` 新增可选 `execution`：

```yaml
execution:
  maxSteps: 10 # 默认 10（原硬编码值）
  maxToolCalls: null # 默认无限制
  timeoutMs: null # 默认无限制
  toolRetry:
    maxRetries: 0 # 默认 0（不重试，向后兼容）
    baseDelayMs: 500
  maxContinuations: 1 # 默认 1（length 续写一次）
```

**理由**：执行预算/重试/续写是「执行控制层」的运行时参数，进 Schema 才能做到「配置即 Agent」，而非散落在代码常量里。默认值全部对齐现状（`maxSteps=10`、无重试），保证向后兼容。`execution` 不属于既有 8 轴，是执行循环的预算约束，独立成块最清晰。

### D6: 补齐 3 个会话级 hook，`HookPoint` 统一 9 个

**选择**：`Hook` 接口新增 `onInit?` / `onSessionStart?` / `onSessionEnd?`（观察类，返回 `void`）；`HookPipeline` 增对应方法；`HookTrace.point` 类型扩展为 9 个（与 config `HookPointSchema` 完全一致）。触发点：`onInit` 在 `resolveAgentConfig` 装配完成后触发一次；`onSessionStart` 在 `AgentLoop` 首次 `run` 前触发一次；`onSessionEnd` 在 `endSession()` 或 `dispose` 时触发一次。

**理由**：AGENTS.md 6.4 清单本就承诺 9 个 hook，config 侧 `HookPointSchema` 已有 9 值，core 侧 `Hook` 接口只有 6 个——补齐并让 core 类型与 config schema 对齐，恢复「单一事实来源」。三类 hook 职责分层：装配级（onInit）/ 会话级（onSessionStart/End）/ 循环级（beforeLLM…onStepEnd）/ 错误级（onError）。

### D7: server `SessionStore` 复用已装配 Agent（in-memory + 抽象接口）

**选择**：新增 `SessionStore`（`Map<sessionId, { agent, dispose, memory, lastActive }>`），TTL 空闲淘汰（默认 30min）+ 数量上限（默认 1000，LRU）。`run` / `run/stream` 请求体加可选 `sessionId`，响应返回 `sessionId`；首次无 `sessionId` → `resolveAgentConfig` 新建并写入 store；复用 → 直接 `agent.run`（memory 累积）。显式结束：`DELETE /api/agent/sessions/:id`（触发 `endSession` + `dispose`）。

**理由**：多轮对话要求同一 `AgentLoop` + 同一 `ConversationMemory` 跨请求存活；`SessionStore` 抽象把「内存 Map」与「redis」隔离（预留 redis 接入点，不本次实现）。TTL/LRU 防止 session 泄漏。`onSessionStart` 由首次 `run` 自动触发，`onSessionEnd` 由 `endSession()`/淘汰触发。

## Risks / Trade-offs

- [并行 tool_calls 与工具副作用顺序] → 并发可能打乱有副作用的工具（如两个写文件）；OpenAI 语义约定并行 tool_calls 相互独立，且 guardrail/文件 roots 仍约束爆炸半径；首版接受该约定，文档注明。
- [重试放大副作用] → 非幂等工具（如发送邮件）重试会重复执行；默认关闭 + 显式开启，风险由配置方自担。
- [anthropic 实时取消不彻底] → 首版 loop 层每轮前检查，SDK 级实时中断留后续；取消延迟最多一轮 LLM 调用。
- [`length` 续写语义] → 追加「继续」消息可能与模型上下文冲突或重复；默认 1 次 + 可配，风险可控。
- [SessionStore 内存增长] → TTL + LRU 上限兜底；分布式/持久化留 redis 接入点（后续 change）。
- [HookPoint 类型扩到 9 个] → 现有 hook 实例未实现新方法属正常（可选方法），`HookPipeline` 对未实现方法跳过，无破坏。

## Migration Plan

无破坏性迁移：

- `execution` 为可选字段，缺省行为 = 现状（`maxSteps=10`、无重试、续写 1 次、无上限）。
- `signal` / `sessionId` 均为可选；不传时行为与现状一致。
- `Hook` 新增 3 个可选方法，现有 hook 无需改动；`HookPoint` 类型从 6 扩到 9 是纯扩展（新增字面量）。
- server 旧调用 `{ config, input }` 不传 `sessionId` 时，仍每请求新建 session（向后兼容）；前端升级后才复用 session。

实现顺序（对应 tasks.md）：Phase A（loop 强化 + config schema）→ 测试 → Phase B（hook 补齐 + session 复用）→ 前端接线 → 全量 typecheck/test/build。
