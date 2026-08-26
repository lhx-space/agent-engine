## Context

RIG 的 `PromptError` 三分法：`MaxTurnsError`（撞轮次上限）/ `ToolError`（工具失败）/ `CompletionError`（模型调用失败）。我们 loop 的设计是「优雅收尾 + 工具重试回填」，与 RIG 的「抛错」略有差异，故做适配映射。

## Goals / Non-Goals

**Goals:** `FinishReason` 归一化；`outcome` 显式化结束方式；`CompletionError` 类型化模型失败。

**Non-Goals:** 不把 maxSteps / 工具失败改成抛错（我们保持优雅收尾 + 重试回填，经 `outcome` / 回填消息表达，忠实于现有 loop）；不做 `ToolError` 独立类（工具失败已有 `executeWithRetry` + 回填）。

## Decisions

- **D1** `FinishReason` 归一化映射：openai `stop`/`length`/`tool_calls`/`content_filter` 原样；anthropic `end_turn`/`stop_sequence`→`stop`、`max_tokens`→`length`、`tool_use`→`tool_calls`；其余→`unknown`。
- **D2** `outcome` 三态：自然结束 `completed` / 撞 `maxSteps` / 超时 `timeout`；loop 内用默认 `max_steps` + break 时覆盖，避免额外状态。
- **D3** `CompletionError` 继承 `Error`，`cause` 用 ES2022 `Error(message, { cause })`；loop 在 provider 调用点包装，`AbortError` 原样透传。
- **D4** `maxSteps` / 工具失败保持「不抛错」——RIG 的 `MaxTurnsError`/`ToolError` 语义落到 `outcome.kind === 'max_steps'` 与回填消息，符合「优雅收尾」而非「抛错」。

## Risks / Trade-offs

- [finishReason 收窄] → `string` → `FinishReason` 读侧兼容（字面量比较仍可用）；少数构造 `ChatCompletionResult` 的测试需同步类型。
- [outcome 必填] → 仅 loop 产出，调用方只读，无破坏。

## Migration Plan

- 非破坏；`AgentLoopResult.outcome` 新增、`finishReason` 收窄。
