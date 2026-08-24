## Why

升级 loop 的「思考可见性」：让模型的原生思考（DeepSeek R1 的 `reasoning_content`）显式透传并展示，实现「边思考 → 边调度 → 最终回复」连续、可观测的体验。当前 provider 只提取 `content`，`reasoning_content` 被丢弃，前端也只展示最终回复，中间「为什么这么调」是黑盒。

## What Changes

- `ChatMessage` 新增 `reasoning?: string` 字段，承载思考内容。
- OpenAI 兼容 provider 透传 `reasoning_content`：非流式读 `message.reasoning_content`，流式读 `delta.reasoning_content` 分片累积。
- `chatCompletionStream` 的 `onDelta` 加 `kind`（`reasoning` / `content`，缺省 `content`），区分思考/回复增量。
- `llm_delta` 事件加 `kind`，loop 透传；前端把「思考」折叠灰显、「回复」正常展示。

## Capabilities

### Modified Capabilities

- `llm-provider`: `ChatMessage.reasoning` + OpenAI 兼容实现透传 `reasoning_content`。
- `agent-loop`: `llm_delta` 事件区分 reasoning / content。
- `web-editor`: 思考折叠灰显 + 回复分开。

## Impact

- 修改 `packages/core/src/llm/{types,openai}.ts`、`packages/core/src/agent/{types,loop}.ts`。
- 修改 `apps/web/src/lib/stream-agent.ts`、`apps/web/src/hooks/use-stream-chat.ts`、`apps/web/src/panels/ChatPanel.tsx`。
- 扩展测试（llm / loop）。
- **向后兼容**：`reasoning` 可选、`onDelta.kind` 缺省 `content`、`llm_delta.kind` 可选；老 provider / 前端不受影响。
