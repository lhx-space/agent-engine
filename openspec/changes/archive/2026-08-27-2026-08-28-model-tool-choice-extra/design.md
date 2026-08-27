## Context

L1 已确立「配置缺省 + 调用覆盖」（`params.X ?? config.X`）与「跨 provider 取交集、静默忽略」两条原则。L2/L4 沿用同一模式：`tool_choice` / `parallel_tool_calls` / `extra` 走 config 缺省 + params 覆盖，`response_format` 从 `json_object` 扩展到 `json_schema`（openai-compatible 透传、anthropic 忽略）。

## Goals / Non-Goals

**Goals:**

- `tool_choice`（auto / none / required / 指定函数）归一化透传；anthropic 映射到其 `tool_choice`（auto / none / any / tool+name）。
- `parallel_tool_calls`（openai-compatible 透传；anthropic 忽略）。
- `response_format` 扩展 `json_schema`（openai-compatible 透传；anthropic 忽略）。
- `extra` 顶层透传兜底（防「闭合字段放不下」再犯）。

**Non-Goals:**

- 不改 `extractStructured` 的默认行为（仍 `json_object`，DeepSeek 兼容；`json_schema` 作为可选项留待后续按需接入）。
- 不做 `logit_bias` / `logprobs` / 推理参数（L3）。

## Decisions

### D1: `tool_choice` 语义取 OpenAI 兼容（auto/none/required/function）

**选择**：config 与 `ChatCompletionParams` 用 OpenAI 兼容语义；anthropic 适配层映射 `required → { type: 'any' }`、`{ function } → { type: 'tool', name }`。

**理由**：默认 DeepSeek（OpenAI 兼容），主语义对齐主 provider；anthropic 差异收敛到其适配层（同 L1 的 D2）。

### D2: `extra` 顶层合并兜底

**选择**：`extra`（`Record<string, unknown>`）在 `baseRequest` / `buildRequest` 里 `...(params.extra ?? config.extra)` 顶层展开，字段名与底层 SDK 原生一致。

**理由**：作为「协议未归一化参数」的逃生舱；不再为每个新 vendor 参数开闭合字段（呼应删 `CapabilityType` 的教训）。命名透传 `extra`（而非嵌套 `params`）保持请求体扁平。

### D3: `response_format` 扩展 `json_schema`

**选择**：`ResponseFormat` 从单一 `json_object` 扩展为可辨识联合 `{ type: 'json_object' } | { type: 'json_schema', json_schema: { name, schema, strict? } }`；openai-compatible 透传，anthropic 忽略。

**理由**：OpenAI 结构化输出 `json_schema` 比 `json_object` 更严格；DeepSeek 目前仅 `json_object`，故默认行为不变、`json_schema` 为显式 opt-in。

## Risks / Trade-offs

- [extra 透传即信任] `extra` 原样透传，可能与归一化字段冲突（同名覆盖）；文档注明「extra 为兜底，优先用归一化字段」。
- [anthropic 忽略 parallel_tool_calls] anthropic 无「禁止并行」开关，静默忽略（D1 取舍）。
- [json_schema 兼容性] DeepSeek 不支持 `json_schema`，调用方需按 provider 能力 opt-in。

## Migration Plan

- 新增字段可选、缺省 undefined，旧配置零迁移。
- 无破坏性变更；文档示例随 docs 一并补充。
