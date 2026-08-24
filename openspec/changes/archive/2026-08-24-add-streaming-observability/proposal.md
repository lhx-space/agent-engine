## Why

Agent 目前是「黑盒」：`AgentLoop.run` 一次性返回最终结果，前端只能看到最终文本，看不到中间过程——LLM 有没有在思考、调了哪个工具、哪个 hook 在哪个点触发了、耗时多少，全都不可见。用户反馈「根本不知道哪一步做了」。同时没有流式输出，长回复要等全部生成完才一次性出现，体验差。

这是「配置即 Agent」的可观测性缺口，也是后续 chat 面板、markdown 流式渲染、步骤时间线的前置地基。

## What Changes

- `LLMProvider` 新增可选流式方法 `chatCompletionStream(params, onDelta)`：文本增量经 `onDelta` 回调逐段吐出，最终仍返回完整 `ChatCompletionResult`（含 tool_calls）。openai / anthropic 两实现补齐（走 SDK 原生 stream）。
- `HookPipeline` 增加 trace 监听：每个 hook 在每个钩子点执行时，产出 `{ hook, point, durationMs, changed }` 事件，让「哪一步做了、是否改写、耗时」可见。
- `AgentLoop.run` 新增可选 `onEvent` 回调：产出结构化事件流（`step_start` / `llm_delta` / `tool_call` / `tool_result` / `hook` / `done` / `error`），流式与非流式都可用。
- server 新增 `POST /api/agent/run/stream`：NDJSON 逐行推送事件；并接 pino 结构化日志（替代散落的 console）。

## Capabilities

### New Capabilities

- `llm-provider`: 流式 chat completion（`chatCompletionStream`）。
- `server-api`: NDJSON 流式端点 `/api/agent/run/stream`。

### Modified Capabilities

- `agent-loop`: `run` 支持 `onEvent` 结构化事件流。
- `hooks-pipeline`: trace 监听（hook 执行点可见）。

## Impact

- 扩展 `packages/core/src/llm/{types,openai,anthropic}.ts`（流式接口 + 实现）。
- 扩展 `packages/core/src/hooks/{types,pipeline}.ts`（`HookTrace` + `onTrace`）。
- 扩展 `packages/core/src/agent/{types,loop}.ts`（`AgentRunEvent` + `onEvent`）。
- 扩展 `packages/core/src/index.ts` 导出新类型。
- 扩展 `packages/server/src/app.ts`（`/api/agent/run/stream`）+ 新增 `packages/server/src/logger.ts`（pino）。
- 新增 `packages/core/tests/streaming.test.ts`、扩展 `hooks`/`server` 测试。
- **无 breaking changes**：`chatCompletionStream`、`onEvent`、`onTrace` 均为可选；`run` 签名向后兼容。
