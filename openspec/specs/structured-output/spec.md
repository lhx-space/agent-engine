# structured-output Specification

## Purpose

TBD - created by archiving change add-structured-output. Update Purpose after archive.

## Requirements

### Requirement: extractStructured 原语

系统 SHALL 提供 `extractStructured({ provider, schema, messages, system?, maxRetries? })`，将模型输出解析并校验为 `z.infer<schema>`；失败 SHALL 回填错误并重试（默认 2 次，`maxRetries` 可覆盖）。

#### Scenario: 解析成功

- **WHEN** 模型返回符合 schema 的 JSON
- **THEN** 返回强类型值（`z.infer<schema>`）

#### Scenario: 校验失败重试

- **WHEN** 首次输出不符合 schema
- **THEN** 将校验错误回填为 follow-up 消息并重试，直至成功或达重试上限

#### Scenario: 超出重试上限抛错

- **WHEN** 连续失败超过 `maxRetries`
- **THEN** 抛出错误（含最后一次校验失败原因）

### Requirement: responseFormat 支持

`ChatCompletionParams` SHALL 支持 `responseFormat: { type: 'json_object' }`；openai-compatible provider SHALL 透传为请求体 `response_format`。

#### Scenario: 透传

- **WHEN** 传入 `responseFormat: { type: 'json_object' }`
- **THEN** openai 请求体含 `response_format: { type: 'json_object' }`
