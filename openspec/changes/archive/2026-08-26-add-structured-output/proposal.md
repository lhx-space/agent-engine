## Why

对齐 RIG「Structured Output（Extractors）」：当前 Agent 只能产出自由文本，缺「LLM → 强类型值」的原语。RIG 用 `extract()` 驱动模型按目标类型输出并做类型安全反序列化；我们复刻为 `extractStructured()`（Zod schema + JSON 模式 + 校验失败重试），并给 provider 补 `responseFormat`（`json_object`）。config 的 `output` 配置轴（JSON Schema 声明式）留作下一步。

## What Changes

- `core/src/structured-output/`：`extractStructured({ provider, schema, messages, system?, maxRetries? })` → 强类型值（JSON 模式 + Zod 校验 + 失败重试）。
- `llm/types.ts`：`ChatCompletionParams` 增 `responseFormat?: { type: 'json_object' }`。
- `llm/openai.ts`：把 `responseFormat` 透传到请求体 `response_format`；anthropic 忽略（prompt 兜底）。
- 导出：`@agent-engine/core/structured-output` 子路径 + 根 `index`。

## Capabilities

### New Capabilities

- `structured-output`: `extractStructured` 结构化输出原语 + `responseFormat`。

### Modified Capabilities

<!-- 无。 -->

## Impact

- 新增 `core/src/structured-output/{extract.ts,index.ts}`。
- 修改 `llm/{types,openai}.ts`、`core/src/{index,types}.ts`、`core/package.json`（subpath exports）。
- 测试：解析成功 / JSON 非法重试 / 校验失败重试 / `responseFormat` 透传。
- **非破坏**：`ChatCompletionParams.responseFormat` 为可选新增。
