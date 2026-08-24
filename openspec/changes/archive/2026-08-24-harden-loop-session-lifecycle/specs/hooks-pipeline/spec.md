## MODIFIED Requirements

### Requirement: Hook 接口

系统 SHALL 定义 `Hook` 接口，含 `name` 与九个钩子点方法：`onInit` / `onSessionStart` / `beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` / `onStepEnd` / `onSessionEnd` / `onError`；其中可改写类方法（beforeLLM / afterLLM / beforeToolCall / afterToolCall）返回 `T | void`，观察类方法（onInit / onSessionStart / onStepEnd / onSessionEnd / onError）返回 `void`。`HookPoint` 类型 SHALL 与 config 的 `HookPointSchema` 九值一致。

#### Scenario: 可改写语义

- **WHEN** `beforeLLM` 返回新的 `ChatMessage[]`
- **THEN** 后续流程使用返回的新值；返回 `void` 则保持原值

#### Scenario: 观察类钩子

- **WHEN** `onStepEnd` / `onError` / `onInit` / `onSessionStart` / `onSessionEnd` 被调用
- **THEN** 其返回值为 `void`，不参与数据改写

#### Scenario: HookPoint 九值对齐

- **WHEN** 查看 `HookPoint` 类型与 config `HookPointSchema`
- **THEN** 二者均为 `onInit` / `onSessionStart` / `beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` / `onStepEnd` / `onSessionEnd` / `onError`

## ADDED Requirements

### Requirement: 会话级 hook 触发

`HookPipeline` SHALL 提供 `onInit` / `onSessionStart` / `onSessionEnd` 三个会话级钩子点的链式执行方法，语义与现有循环级钩子一致（按注册顺序、返回 void、产出 `HookTrace`）。

#### Scenario: 会话级钩子链式执行

- **WHEN** 注册多个含 `onSessionStart` 的 hook 并触发该点
- **THEN** 按注册顺序依次调用，每个产出 `{ hook, point: 'onSessionStart', durationMs, changed }` trace

#### Scenario: 未实现方法跳过

- **WHEN** 某 hook 未实现 `onSessionStart`
- **THEN** 触发该点时不调用该方法，无副作用
