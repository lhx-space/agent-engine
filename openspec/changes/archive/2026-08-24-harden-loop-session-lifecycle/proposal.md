## Why

当前 `AgentLoop` 是一次性、无状态的「demo 级」ReAct 循环，离「真正可用」差一截：

- **并行 tool_calls 被串行执行**：模型一次返回多个 tool_call 时 `for` 顺序跑，latency 白白翻倍。
- **工具失败无重试**：抛错直接回填 `Error: ...`，没有退避重试（OpenAI Agents SDK 是内置 retry 的）。
- **流式无法取消**：`ChatCompletionParams.signal` 有字段，但 `AgentRunOptions` 不暴露，前端点停止无法真正中断。
- **`finishReason` 不区分**：`stop` / `length`（截断）/ `tool_calls` 全当「无 tool_calls 就退出」，`length` 截断会被误判成「回答完了」。
- **`maxSteps` 硬编码 10**：步数上限、工具调用上限、总耗时上限都不可配置。
- **会话无生命周期**：server 每请求 `resolveAgentConfig → run → dispose`，多轮对话是假的；`onInit` / `onSessionStart` / `onSessionEnd` 三个 hook 在 AGENTS.md 6.4 承诺了但 core 侧缺失。

这是 AGENTS.md M3 剩余项（长期记忆 / 编排 / events 总线）的共同前置：没有跨请求的 Agent 生命周期，三层记忆（跨会话）和编排都无从谈起。

## What Changes

**Phase A — ReAct loop 强化（纯内核）：**

- 并行执行多个 `tool_calls`（`Promise.allSettled` + 顺序回填），单工具失败不阻塞其他。
- 工具执行失败自动重试 + 指数退避（默认关闭，向后兼容）。
- `AgentRunOptions.signal` 透传 `AbortSignal`，支持流式/非流式取消。
- `finishReason` 区分处理：`length` 截断自动续写（默认 1 次，可配）。
- 新增顶层 `execution` 配置块（`maxSteps` / `maxToolCalls` / `timeoutMs` / `toolRetry` / `maxContinuations`）。

**Phase B — 会话生命周期：**

- 补齐 `Hook` 接口与 `HookPipeline` 的 `onInit` / `onSessionStart` / `onSessionEnd`，`HookPoint` 统一为 9 个（对齐 config 的 `HookPointSchema`）。
- `AgentLoop` 引入会话边界：首次 `run` 触发 `onSessionStart`，`endSession()` / `dispose` 触发 `onSessionEnd`。
- server 引入 `SessionStore`（`sessionId → 已装配 agent` 复用 + TTL / 上限淘汰），`run` / `run/stream` 请求体加可选 `sessionId`，响应返回 `sessionId`，多轮对话真正成立。

## Capabilities

### New Capabilities

- `agent-config-schema`: 顶层 `execution` 配置块。
- `server-api`: session 复用（`sessionId` + `SessionStore`）。

### Modified Capabilities

- `agent-loop`: 并行 tool_calls、工具重试、流式取消、finishReason 续写、execution 预算、会话边界 hook。
- `hooks-pipeline`: `Hook` 接口补齐 3 个会话级 hook，`HookPoint` 9 个。
- `agent-resolve`: `onInit` 在装配完成后触发。

## Impact

- 扩展 `packages/config/src/schema/index.ts`（`ExecutionConfigSchema` + `AgentConfig.execution`）。
- 扩展 `packages/core/src/agent/{loop,assemble,types}.ts`（并行执行、重试、取消、续写、会话边界）。
- 扩展 `packages/core/src/hooks/{types,pipeline}.ts`（3 个 hook + HookPoint 9 个）。
- 扩展 `packages/core/src/resolve/resolve.ts`（`onInit` 触发 + execution 透传）。
- 扩展 `packages/core/src/llm/{openai,anthropic}.ts`（signal 透传）。
- 新增 `packages/server/src/session-store.ts`；扩展 `packages/server/src/app.ts`（sessionId 复用）。
- 扩展 `apps/web`（`sessionId` 从响应取回并回传）。
- 新增/扩展 `core/tests/`（并行、重试、取消、续写、会话边界）、`server/tests/`（session 复用）。
- **向后兼容**：`execution` 可选、重试默认关闭、`signal` 可选、`sessionId` 可选；老配置与老调用方零改动。
