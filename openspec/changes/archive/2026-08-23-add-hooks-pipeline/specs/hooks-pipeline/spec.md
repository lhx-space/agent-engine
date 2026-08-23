## ADDED Requirements

### Requirement: Hook 接口

系统 SHALL 定义 `Hook` 接口，含 `name` 与循环内钩子点方法：`beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` / `onStepEnd` / `onError`；其中可改写类方法（beforeLLM / afterLLM / beforeToolCall / afterToolCall）返回 `T | void`。

#### Scenario: 可改写语义

- **WHEN** `beforeLLM` 返回新的 `ChatMessage[]`
- **THEN** 后续流程使用返回的新值；返回 `void` 则保持原值

#### Scenario: 观察类钩子

- **WHEN** `onStepEnd` / `onError` 被调用
- **THEN** 其返回值为 `void`，不参与数据改写

### Requirement: HookPipeline 链式执行

系统 SHALL 提供 `HookPipeline`，支持 `register`（注册 hook），并按注册顺序对每个钩子点链式执行——前一 hook 的返回值作为后一 hook 的入参。

#### Scenario: 多 hook 顺序执行

- **WHEN** 注册两个 hook 且都实现了 `beforeLLM`
- **THEN** 按注册顺序依次调用，第二个 hook 收到第一个 hook 的返回值

#### Scenario: 返回 void 保持原值

- **WHEN** 某 hook 的 `beforeLLM` 返回 `void`
- **THEN** 该钩子点不改变当前数据，继续传给下一个 hook

### Requirement: Agent Loop 集成

Agent Loop SHALL 在对应节点调用 HookPipeline：每轮循环前 `beforeLLM`、模型返回后 `afterLLM`、工具执行前 `beforeToolCall`、工具执行后 `afterToolCall`、每轮结束 `onStepEnd`。

#### Scenario: 钩子点触发

- **WHEN** 运行一个含工具调用的循环
- **THEN** 各钩子点按执行顺序被触发（beforeLLM → afterLLM → beforeToolCall → afterToolCall → onStepEnd）

### Requirement: 错误处理

hook 抛错 SHALL 触发 `onError`（若已注册）后向上抛出；`onError` 不吞掉错误。

#### Scenario: hook 抛错向上传播

- **WHEN** 某 hook 的 `beforeLLM` 抛错
- **THEN** `onError` 被触发（若注册），随后错误向上抛出

### Requirement: 无阻断语义

hooks SHALL 不提供「阻断执行」的能力——阻断是 rules（guardrail）的职责。

#### Scenario: 接口不含阻断分支

- **WHEN** 查看 Hook 接口的返回类型
- **THEN** 返回类型只有 `T | void`，无「阻断/中止」分支
