## Context

RIG 的 Extractors：给目标类型，LLM 解析为强类型值。我们对应 `extractStructured`（Zod）。Zod 已内置 `toJSONSchema`（tool registry 已在用），零新依赖。

## Goals / Non-Goals

**Goals:** `extractStructured` 原语（JSON 模式 + 校验 + 重试）；`responseFormat` provider 支持；导出 + 测试。

**Non-Goals:** config `output` 配置轴（JSON Schema 声明式，需 ajv 或 json-schema-to-zod，下一步）；batch 提取；流式结构化输出。

## Decisions

- **D1** `extractStructured` 放 `core/src/structured-output/`（独立子路径 `.../structured-output`），避免污染 `llm/`。
- **D2** 机制：`zod.toJSONSchema(schema)` 注入 system 提示 + `responseFormat: { type: 'json_object' }` + `JSON.parse` + `safeParse`；失败把错误回填为 follow-up 消息重试（默认 2 次）。
- **D3** `responseFormat` 仅 openai-compatible 透传 `response_format`；anthropic 无 JSON 模式，靠 system 提示 + 重试兜底。
- **D4** 返回类型 `z.infer<Schema>`（泛型推导，禁止 `any`）。

## Risks / Trade-offs

- [json_object 依赖提示词] → 部分模型要求 prompt 含 "json"；system 指令已含「JSON only」，规避。
- [anthropic 无 json 模式] → 提示词兜底，重试机制兜底解析失败。

## Migration Plan

- 非破坏：新增可选字段与子路径；`ChatCompletionParams` 新增字段缺省 undefined，行为不变。
