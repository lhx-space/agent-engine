## Why

`ModelConfigSchema` 目前只有 `temperature` / `maxTokens` 两个生成参数，但这两个字段实际是「死配置」——`AgentLoop` 构造 `ChatCompletionParams` 时只传 messages/tools/signal，Provider 的 `baseRequest` 读的是 `params.temperature`（undefined）而非 `config.temperature`，导致配置里的采样参数从未生效。同时 L1 需要的 `top_p` / `frequency_penalty` / `presence_penalty` / `stop` / `seed` 均未暴露。

本 change 落地「模型采样参数归一化透传」：`ModelConfig` 作为缺省值、`ChatCompletionParams` 作为单次覆盖，Provider 只透传其底层协议支持的字段；顺带修复 `temperature` / `maxTokens` 未生效的问题。

## What Changes

- **config**：`ModelConfigSchema` 新增 `topP`（0~~1）、`frequencyPenalty`（-2~~2）、`presencePenalty`（-2~2）、`stop`（string[]）、`seed`（int）可选字段。
- **core `llm/types.ts`**：`ChatCompletionParams` 新增同名可选字段（`topP` / `frequencyPenalty` / `presencePenalty` / `stop` / `seed`）。
- **core `llm/openai.ts`**：`baseRequest` 改为 `params.X ?? config.X` 透传，新增 `top_p` / `frequency_penalty` / `presence_penalty` / `stop` / `seed`；顺带修复 `temperature` / `maxTokens`。
- **core `llm/anthropic.ts`**：`buildRequest` 透传 `top_p` / `stop_sequences`（并 `temperature` / `maxTokens`）；不支持的 `frequencyPenalty` / `presencePenalty` / `seed` 静默忽略。

## Capabilities

### Modified Capabilities

- `agent-config-schema`: `model` 子 Schema 新增采样参数字段。
- `llm-provider`: Provider 按「配置缺省 + 调用覆盖」归一化透传采样参数。

## Impact

- 修改 `packages/config/src/schema/index.ts` 与 `packages/config/tests/schema.test.ts`。
- 修改 `packages/core/src/llm/{types.ts,openai.ts,anthropic.ts}` 与 `packages/core/tests/llm.test.ts`。
- 兼容性：`model.temperature` / `maxTokens` 字段名不变；新增字段全部可选、缺省 undefined，旧配置零迁移。`temperature` / `maxTokens` 开始真正生效（此前为死配置）。
