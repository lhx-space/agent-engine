## Why

`deepseek-reasoner` 会消耗多个 step 在「思考 + 规划 + 逐步调研」上，`maxSteps`（默认 10）兜底时，模型往往还在调工具（如更新 todo），真正的最终答案没来得及输出——结果把「带 tool_calls 的中间消息」当成了最终结果，用户只看到「思考 + 工具过程」，看不到结论。

## What Changes

`AgentLoop` 循环因 `maxSteps` / 超时预算退出时，若最后一条 assistant 消息仍带 `toolCalls`，追加一轮「不带工具」的总结调用：强制模型纯文本给出最终结论，不再调用工具。

## Capabilities

### Modified Capabilities

- `agent-loop`: 终止条件——预算兜底时强制收尾。

## Impact

- 修改 `packages/core/src/agent/loop.ts`（while 循环后追加总结调用）。
- 更新 `agent-loop.test.ts`、`loop-hardening.test.ts` 相关测试 + 新增总结测试。
- 无 breaking changes（仅在「预算兜底且仍带 toolCalls」时多一次 LLM 调用）。
