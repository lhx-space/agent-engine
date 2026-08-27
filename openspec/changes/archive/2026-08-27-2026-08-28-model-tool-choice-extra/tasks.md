## 1. config schema

- [x] 1.1 `ModelConfigSchema` 新增 toolChoice / parallelToolCalls / extra
- [x] 1.2 `schema.test.ts` 补解析用例

## 2. core LLM 协议

- [x] 2.1 `llm/types.ts`：`ToolChoice` 类型 + `ResponseFormat` 扩展 `json_schema` + `ChatCompletionParams` 加字段
- [x] 2.2 `openai.ts` 透传 tool_choice / parallel_tool_calls / extra + json_schema
- [x] 2.3 `anthropic.ts` tool_choice 映射 + extra 透传 + 忽略不支持字段

## 3. 测试

- [x] 3.1 `llm.test.ts` 补 tool_choice / parallel_tool_calls / extra / json_schema 用例

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
