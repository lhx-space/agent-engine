## Why

L1 落地了采样参数归一化，但「工具调用控制」与「厂商透传兜底」仍是空白：`tool_choice`（强制/禁止调工具）、`parallel_tool_calls`（禁止并行）、`response_format` 的 `json_schema` 结构化输出，以及 vendor 原生参数透传 `extra`。本 change 补齐 L2（工具控制 + 结构化输出）+ L4（透传兜底），与 L1 的「配置缺省 + 调用覆盖」语义一致。

## What Changes

- **config**：`ModelConfigSchema` 新增 `toolChoice`（auto/none/required/function）、`parallelToolCalls`（boolean）、`extra`（`Record<string, unknown>`，vendor 透传兜底）。
- **core `llm/types.ts`**：新增 `ToolChoice` 类型；`ResponseFormat` 扩展 `json_schema`；`ChatCompletionParams` 新增 `toolChoice` / `parallelToolCalls` / `extra`。
- **core `llm/openai.ts`**：透传 `tool_choice` / `parallel_tool_calls` / `extra`（顶层合并）；`response_format` 支持 `json_schema`。
- **core `llm/anthropic.ts`**：`tool_choice` 映射（auto→auto、required→any、none→none、function→tool+name）；`extra` 顶层透传；忽略 `parallel_tool_calls` / `response_format`（anthropic 不支持）。

## Capabilities

### Modified Capabilities

- `agent-config-schema`: `model` 子 Schema 新增工具调用与透传字段。
- `llm-provider`: Provider 归一化透传 `tool_choice` / `parallel_tool_calls` / `extra`，扩展 `response_format` 为 `json_schema`。

## Impact

- 修改 `packages/config/src/schema/index.ts`、`packages/config/tests/schema.test.ts`。
- 修改 `packages/core/src/llm/{types.ts,openai.ts,anthropic.ts}`、`packages/core/tests/llm.test.ts`。
- 兼容性：新增字段全部可选、缺省 undefined，旧配置零迁移。
