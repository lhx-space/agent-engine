## Context

批 A 的 P0 两项：流式事件可扩展 + Human-in-the-loop。前者是「可观测扩展」——`AgentRunEvent` 封闭联合让插件/用户无法往流里塞自定义事件；后者是「控制流扩展」——`beforeToolCall` 只能改写、不能暂停等审批。本 change 各加一个最小原语。

## Goals / Non-Goals

**Goals:**

- `AgentRunEvent.custom` 变体 + 事件总线 `custom` → `onEvent` 转发（用户/插件可发自定义流式事件）。
- `AgentRunOptions.approveToolCall`：工具执行前 await 人类决策，拒绝则阻断并回填原因。

**Non-Goals:**

- 不做审批的持久化/超时/多级审批流（M3+）；本次是「单次 await 决定」最小原语。
- 不做「修改参数后放行」的审批（`beforeToolCall` hook 已能改写参数；审批只做放行/拒绝）。
- 不做前端审批 UI（server/web 层后续接 `approveToolCall`）。

## Decisions

### D1: 流式 custom 经事件总线转发，不新增「emit 通道」

**选择**：`AgentRunEvent` 加 `custom` 变体；`AgentLoopOptions.eventBus` 注入总线；`run` 期间订阅总线把 `custom` 事件转发为 `onEvent({ type:'custom', name, data })`，run 结束（含异常）退订。

**理由**：事件总线已是「自定义事件」的唯一出口（`custom` 逃生舱），流式只是「总线 → onEvent」的桥；不另造一套 emit 通道，复用现有 `EventBus`，语义单一。转发在 `run` 内订阅/退订，随 run 生命周期、不跨会话泄漏。

### D2: Human-in-the-loop 用 `approveToolCall` 回调，不做 hook 扩展

**选择**：`AgentRunOptions.approveToolCall?(name, args) => Promise<ToolApproval>`；循环在「guardrail 放行后、执行前」顺序 await；`approved:false` 则阻断并把 `reason ?? 'Rejected by human'` 回填为工具结果。

**理由**：Human-in-the-loop 是「本轮会话里有人类参与」的运行时决策，粒度应在 `run` 调用层（每次 run 的审批者可能不同），而非装配级 hook；不扩展 hook（保持 hooks「观察+改写、不阻断」的职责边界）。审批在 guardrail 之后——安全拦截优先，人为审批是「更高信任」的放行。

### D3: 拒绝结果回填为 tool 消息，让模型感知

**选择**：拒绝时产出与 guardrail 阻断一致的 `Blocked: <reason>` 工具结果回填（含 toolCallId 配对），模型据此调整或停止。

**理由**：回填比「静默丢弃」更诚实，模型能看到「被人类拒绝 + 原因」，避免反复重试同一危险工具。

## Risks / Trade-offs

- [审批回调阻塞循环] → `approveToolCall` await 期间循环挂起，人类不响应则 run 挂住；这是 Human-in-the-loop 的预期语义，超时/降级留 M3+。
- [custom 数据弱类型] → `data?: unknown` 逃生舱；与事件总线 `custom` 一致，用户自行收窄。
- [拒绝原因注入 prompt] → 回填文本来自审批方，需注意不被模型 prompt injection；与 guardrail reason 同风险，留安全层后续统一处理。

## Migration Plan

- 均为新增可选字段/变体，向后兼容。
- server/web 后续：把 HTTP 流式端点接 `approveToolCall`（长轮询/WebSocket 审批）与 `onEvent custom` 展示。
