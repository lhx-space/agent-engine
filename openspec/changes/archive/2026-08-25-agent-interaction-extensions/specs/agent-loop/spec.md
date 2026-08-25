## ADDED Requirements

### Requirement: 流式自定义事件

系统 SHALL 在 `AgentRunEvent` 提供 `{ type:'custom'; name; data? }` 变体；当 `AgentLoop` 注入了 `eventBus`，`run` 期间 SHALL 把事件总线的 `custom` 事件转发到 `onEvent`（run 结束含异常时退订）。

#### Scenario: 自定义事件转发

- **WHEN** `AgentLoop` 注入事件总线并 `run`，期间总线 `emit({ type:'custom', name, data })`
- **THEN** `onEvent` 收到 `{ type:'custom', name, data }`

### Requirement: Human-in-the-loop 审批

系统 SHALL 提供 `AgentRunOptions.approveToolCall(name, args): Promise<ToolApproval>`；循环在工具「guardrail 放行后、执行前」顺序 await 审批，`approved:false` 时阻断执行并把 `reason ?? 'Rejected by human'` 回填为工具结果（含 toolCallId 配对）。

#### Scenario: 拒绝阻断

- **WHEN** `approveToolCall` 返回 `{ approved:false, reason }`
- **THEN** 工具不执行，结果回填含 `reason` 的阻断文本，模型可据此调整

#### Scenario: 放行执行

- **WHEN** `approveToolCall` 返回 `{ approved:true }`
- **THEN** 工具正常执行，结果回填
