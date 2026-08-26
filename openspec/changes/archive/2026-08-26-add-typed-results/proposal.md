## Why

对齐 RIG「Error handling」：`PromptError` 区分 `MaxTurnsError` / `ToolError` / `CompletionError`。我们当前 `finishReason` 是裸字符串（openai 与 anthropic 原样透传，`length` 之外无从判断），loop 的结束方式（自然结束 / 撞 maxSteps / 超时）也无类型。本 change 做「结果归一化 + 类型化错误」：`FinishReason` 联合类型跨 provider 归一、`AgentLoopResult.outcome` 显式化结束方式、`CompletionError` 类型化模型调用失败。

## What Changes

- `llm/types.ts`：`FinishReason`（`stop | length | tool_calls | content_filter | unknown`）+ `CompletionError`；`ChatCompletionResult.finishReason` 改类型。
- `llm/openai.ts` / `llm/anthropic.ts`：`finish_reason` / `stop_reason` 归一化为 `FinishReason`（流式 + 非流式）。
- `agent/types.ts`：`AgentRunOutcome`（`completed | max_steps | timeout`）；`AgentLoopResult` 增 `outcome` 且 `finishReason` 改类型。
- `agent/loop.ts`：跟踪结束方式写入 `outcome`；provider 调用失败包成 `CompletionError`（AbortError 原样透传）。

## Capabilities

### New Capabilities

- `typed-results`: 跨 provider 结果归一化 + 类型化错误。

## Impact

- 修改 `llm/{types,openai,anthropic}.ts`、`agent/{types,loop}.ts`、`core/src/{index,types}.ts`。
- 测试：归一化映射（openai/anthropic）、outcome（completed/max_steps/timeout）、CompletionError 包装。
- **非破坏**：`finishReason` 由 `string` 收窄为 `FinishReason`（读侧兼容）；`outcome` 为新增必填字段（仅 loop 产出，调用方只读）。
