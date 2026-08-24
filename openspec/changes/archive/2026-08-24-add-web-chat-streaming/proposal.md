## Why

阶段 1 打通了后端流式事件流（NDJSON），但前端仍是「一次性返回 + 纯文本 pre 渲染」。用户要的是：左边是长对话 chat 面板、内容 markdown 渲染、流式渲染优化（queue 缓存 + rAF 节流）、把每一步清晰化（步骤时间线）。这是「配置即 Agent」从「能跑」到「好用可观测」的关键一步。

## What Changes

- 前端新增流式消费：`fetch` + `res.body.getReader()` 按行解析 NDJSON 事件流（`/api/agent/run/stream`）。
- 布局重排为：左 chat 对话面板 / 中 agent 配置 / 右 system-prompt。
- chat 面板：多轮消息列表（复用 `@ant-design/x` 的 `Bubble` / `Bubble.List`），assistant 消息用 `react-markdown` + `remark-gfm` 渲染。
- 流式渲染优化：token 先入 buffer，`requestAnimationFrame` 节流批量 flush（每帧最多一次 setState），非流式时一次性渲染。
- 步骤时间线：`step_start` / `tool_call` / `tool_result` / `hook` / `done` / `error` 事件折叠展示在对应消息下方，让「哪一步做了什么」可见。

## Capabilities

### New Capabilities

- `web-editor`: 流式 chat 面板 + markdown 渲染 + rAF 节流 + 步骤时间线。

### Modified Capabilities

（无）

## Impact

- 新增 `apps/web/src/lib/stream-agent.ts`（NDJSON 流式读取 + 事件类型）。
- 新增 `apps/web/src/hooks/use-stream-chat.ts`（buffer + rAF 节流 + 消息状态机）。
- 新增 `apps/web/src/panels/ChatPanel.tsx`（消息列表 + 步骤时间线）。
- 重写 `apps/web/src/App.tsx`（布局重排）+ `styles.css`。
- 移除旧 `RunPanel.tsx`（能力并入 ChatPanel）。
- 依赖新增：`@ant-design/x` + `react-markdown` + `remark-gfm`。
- **无后端改动**：复用阶段 1 的 NDJSON 端点。
