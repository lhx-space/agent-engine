## 1. LLMProvider 流式接口

- [x] 1.1 `llm/types.ts` 新增 `chatCompletionStream?(params, onDelta)`（可选方法）
- [x] 1.2 `llm/openai.ts` 实现流式（`stream: true`，text delta 经 onDelta，tool_calls 流结束聚合）
- [x] 1.3 `llm/anthropic.ts` 实现流式（text_delta 逐块 onDelta，tool_use 流结束聚合）

## 2. HookPipeline trace

- [x] 2.1 `hooks/types.ts` 新增 `HookTrace` 类型
- [x] 2.2 `hooks/pipeline.ts` 新增 `onTrace(listener)`，每个 hook 每次执行产出 `{ hook, point, durationMs, changed }`

## 3. AgentLoop 事件流

- [x] 3.1 `agent/types.ts` 新增 `AgentRunEvent` 联合类型 + `run` 签名加 `onEvent?`
- [x] 3.2 `agent/loop.ts`：`step_start` / `llm_delta`（流式时） / `tool_call` / `tool_result` / `hook`（转发 pipeline trace）/ `done` / `error` 事件；非流式 provider 回退 `chatCompletion`

## 4. server 流式端点 + pino

- [x] 4.1 新增 `server/src/logger.ts`（pino 实例）
- [x] 4.2 `server/src/app.ts` 新增 `POST /api/agent/run/stream`（NDJSON，逐行写事件 + pino 记录）
- [x] 4.3 `server/src/index.ts` 导出 logger

## 5. 导出与测试

- [x] 5.1 `core/src/index.ts` 导出 `AgentRunEvent` / `HookTrace` 等新类型
- [x] 5.2 新增 `core/tests/streaming.test.ts`（provider 流式 + loop 事件流 + hook trace）
- [x] 5.3 扩展 `server/tests/`（stream 端点返回 NDJSON 事件）
