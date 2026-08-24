## Context

把黑盒的 Agent 运行变成可观测的流式事件流。这是 chat 面板、markdown 流式渲染、步骤时间线的前置。核心约束：**不破坏现有非流式调用**（`chatCompletion` / `run` 签名向后兼容），复用 SDK 原生 stream，不自研流式协议解析。

## Goals / Non-Goals

**Goals:**

- `LLMProvider.chatCompletionStream`（可选方法），openai / anthropic 都实现。
- `HookPipeline.onTrace`：每个 hook 每次执行产出 trace。
- `AgentLoop.run` 支持 `onEvent` 结构化事件流（流式 + 非流式）。
- server NDJSON 流式端点 + pino 日志。

**Non-Goals:**

- 不做前端 chat 面板 / markdown 渲染（阶段 2）。
- 不做多轮会话管理（memory 已有，前端接线在阶段 2）。
- 不做 SSE（用 NDJSON，见 D1）。

## Decisions

### D1: 流式协议用 NDJSON（非 SSE）

**选择**：`POST /api/agent/run/stream` 返回 `application/x-ndjson`，每行一个 JSON 事件。

**理由**：事件类型自定义（step/tool/hook/delta），NDJSON 逐行解析比 SSE 的 `event:`/`data:` 分帧更简单直接；前端 `fetch` + `res.body.getReader()` 按 `\n` 切行即可。SSE 的自动重连、`id` 语义这里用不上。

### D2: Provider 流式 = `onDelta` 回调 + 最终完整结果

**选择**：`chatCompletionStream(params, onDelta): Promise<ChatCompletionResult>`。

**理由**：ReAct loop 需要「最终完整 message（含 tool_calls）」来继续决策，流式只优化「文本呈现」这一层。`onDelta` 只回传文本增量；tool_calls 在流结束时一次性返回（OpenAI 流式下 tool_calls 会分片到达，SDK 内部聚合）。这样 loop 逻辑改动最小，且 tool 调用不需要「边流式边拼参数」。

### D3: 事件流是「观察者回调」，不是返回迭代器

**选择**：`AgentLoop.run(userInput, { onEvent })` 而非 `runStream()` 返回 AsyncIterable。

**理由**：loop 内部是交错 await（LLM → tool → LLM），用回调天然适配；server 层拿到回调后写入 NDJSON 响应流。返回迭代器反而要处理背压/中断，复杂且无收益。`onEvent` 可选，老调用 `run(userInput)` 零改动。

### D4: hook trace 用 `changed` 布尔标记改写

**选择**：trace 事件 `{ hook, point, durationMs, changed }`，`changed` = 该 hook 返回了与入参不同的值（改写）还是 void（保持原值）。

**理由**：让前端能区分「hook 只是观察（日志/埋点）」还是「改写了结果（注入/过滤）」。不把改写后的完整内容塞进事件（可能很大且敏感），只标布尔。

### D5: pino 放 server 层，core 不引日志框架

**选择**：core 只产出结构化事件（`onEvent` / `onTrace`），server 用 pino 记录这些事件；core 内现有的 `console.warn/error`（MCP 连接失败、装配）暂时保留，后续统一。

**理由**：core 保持纯 runtime、零日志框架耦合；日志策略是部署层的事。这也和「env 上移 server」一致。

## Risks / Trade-offs

- [OpenAI 流式 tool_calls 分片聚合] → SDK 在流结束时给出完整 tool_calls，onDelta 只发文本；风险低。
- [Anthropic 流式 text_delta 需要逐块拼接] → SDK 原生支持，逐块 onDelta 即可。
- [NDJSON 无内置重连] → 前端 `getReader` 一次读取；中断即视为结束（AbortController 由前端控制），首版够用。
- [事件量大导致响应头过长] → NDJSON 无 header 累积问题（SSE 才有）；每行独立，前端逐行消费。

## Migration Plan

无破坏。`chatCompletionStream` 为可选方法（缺省时 `run` 回退 `chatCompletion` 非流式）；`onEvent` 可选；`onTrace` 可选。老调用方零改动。
