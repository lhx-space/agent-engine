# typed-results Specification

## Purpose

TBD - created by archiving change add-typed-results. Update Purpose after archive.

## Requirements

### Requirement: FinishReason 归一化

系统 SHALL 提供 `FinishReason`（`stop | length | tool_calls | content_filter | unknown`），并将 provider 的原生结束原因归一化：openai 原样透传已知值；anthropic `end_turn`/`stop_sequence` → `stop`、`max_tokens` → `length`、`tool_use` → `tool_calls`；未识别值 → `unknown`。

#### Scenario: anthropic 归一化

- **WHEN** anthropic 返回 `stop_reason: 'end_turn'` 或 `'max_tokens'`
- **THEN** `ChatCompletionResult.finishReason` 分别为 `'stop'` / `'length'`

### Requirement: 结束方式 outcome

`AgentLoopResult` SHALL 提供 `outcome`：自然结束 `{ kind: 'completed' }`、达到 `maxSteps` `{ kind: 'max_steps' }`、超时 `{ kind: 'timeout' }`。

#### Scenario: 撞 maxSteps

- **WHEN** 模型持续调用工具直至 `steps` 达到 `maxSteps`
- **THEN** `result.outcome.kind === 'max_steps'`

#### Scenario: 自然结束

- **WHEN** 模型在预算内给出最终回答
- **THEN** `result.outcome.kind === 'completed'`

### Requirement: CompletionError

系统 SHALL 提供 `CompletionError`（类型化模型调用失败）；loop 在 provider 调用失败时 SHALL 抛出 `CompletionError`（`cause` 保留原错误），`AbortError` SHALL 原样透传。

#### Scenario: 包装 provider 错误

- **WHEN** `provider.chatCompletion` 抛错
- **THEN** loop 抛出 `CompletionError`，其 `cause` 为原错误
