## 1. config schema

- [x] 1.1 `ModelConfigSchema` 新增 topP / frequencyPenalty / presencePenalty / stop / seed（含范围校验）
- [x] 1.2 `schema.test.ts` 补采样参数解析与越界拒绝用例

## 2. core LLM 协议

- [x] 2.1 `ChatCompletionParams` 新增同名可选字段
- [x] 2.2 `openai.ts` 透传（配置缺省 + 调用覆盖）
- [x] 2.3 `anthropic.ts` 透传交集字段、忽略不支持字段

## 3. 测试

- [x] 3.1 `llm.test.ts` 补 openai-compatible 采样透传 + 覆盖 + anthropic 归一化用例

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
