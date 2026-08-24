## Phase A — ReAct loop 强化

- [x] A1 `packages/config/src/schema/index.ts`：新增 `ExecutionConfigSchema`（maxSteps/maxToolCalls/timeoutMs/toolRetry/maxContinuations）并挂到 `AgentConfig.execution`（可选，全量默认）
- [x] A2 `packages/core/src/agent/types.ts`：`AgentRunOptions` 加 `signal?: AbortSignal`；`AgentLoopResult` 加 `finishReason`；`AgentExecutionOptions`
- [x] A3 `packages/core/src/agent/loop.ts`：并行 tool_calls（`Promise.all` + 顺序回填）、工具重试（指数退避）、AbortSignal 协作式检查 + AbortError、finishReason 区分与续写、execution 预算（maxSteps/maxToolCalls/timeoutMs）
- [x] A4 `packages/core/src/llm/openai.ts` + `anthropic.ts`：`signal` 透传 / 请求前 aborted 检查
- [x] A5 `packages/core/src/agent/assemble.ts` + `resolve/resolve.ts`：execution 透传到 AgentLoop
- [x] A6 新增 `packages/core/tests/loop-hardening.test.ts`（并行/重试/取消/续写/预算）

## Phase B — 会话生命周期

- [x] B1 `packages/core/src/hooks/types.ts`：`Hook` 接口加 onInit/onSessionStart/onSessionEnd；`HookPoint` 扩为 9 值
- [x] B2 `packages/core/src/hooks/pipeline.ts`：新增 onInit/onSessionStart/onSessionEnd 链式方法 + trace
- [x] B3 `packages/core/src/agent/loop.ts`：会话边界（首次 run 触发 onSessionStart、endSession() 触发 onSessionEnd 并清空 memory）
- [x] B4 `packages/core/src/resolve/resolve.ts`：装配完成触发 onInit（失败释放资源）；会话 memory 始终创建
- [x] B5 新增 `packages/server/src/session-store.ts`：SessionStore（in-memory + TTL + LRU + 抽象接口）
- [x] B6 `packages/server/src/app.ts`：run/run/stream 支持 sessionId 复用 + 响应返回 sessionId（stream 用 `x-session-id` 头）+ `DELETE /api/agent/sessions/:id`
- [x] B7 `apps/web`：sessionId 从响应头取回并回传（stream-agent / use-stream-chat）
- [x] B8 新增 `packages/core/tests/session-lifecycle.test.ts` + `packages/server/tests/session.test.ts`（session 复用/淘汰）

## 收尾

- [x] C1 `packages/core/src/index.ts` 导出 `AbortError`；`packages/server/src/index.ts` 导出 `SessionStore`
- [x] C2 全量 `pnpm test`（200 passed）+ `pnpm typecheck`（8 packages）+ web typecheck/build + rslint/cspell/prettier
- [ ] C3 OpenSpec `validate --strict` 通过后归档
