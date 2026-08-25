## Why

批 A 收尾（AGENTS.md §2.2 的 P0 两项）：① Human-in-the-loop 缺失——`beforeToolCall` 只能改写、不能暂停等人类审批；② 流式事件不可扩展——`AgentRunEvent` 是封闭联合，用户/插件无法往流里塞自定义事件。本 change 落地两个「让外部参与执行与观测」的原语。

## What Changes

- `AgentRunEvent` 新增 `{ type:'custom'; name; data? }` 变体；`AgentLoopOptions.eventBus` + `run` 期间把事件总线 `custom` 事件转发到 `onEvent`。
- 新增 `ToolApproval`（`approved` / `reason?`）与 `AgentRunOptions.approveToolCall`：工具执行前（guardrail 放行后）`await` 人类审批，`false` 阻断并把原因回填为工具结果（`Rejected by human` / 自定义原因）。

## Capabilities

### Modified Capabilities

- `agent-loop`: 新增「流式自定义事件」与「Human-in-the-loop 审批」需求。

## Impact

- 修改 `packages/core/src/agent/{types,loop,assemble}.ts`。
- 测试：`agent-interaction.test.ts`（custom 转发 + Human-in-the-loop 拒绝/放行）。
- **非破坏**：均为新增可选字段/变体，现有 run 行为不变。
