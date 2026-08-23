## ADDED Requirements

### Requirement: GuardrailRule 接口

系统 SHALL 定义 `GuardrailRule` 接口，含 `id`、`on`（beforeToolCall / afterToolCall）、`validate(ctx)` → `GuardrailResult`；`GuardrailResult` 含 `allowed` 与可选 `reason`。

#### Scenario: 允许放行

- **WHEN** `validate` 返回 `{ allowed: true }`
- **THEN** 工具正常执行

#### Scenario: 阻断并给原因

- **WHEN** `validate` 返回 `{ allowed: false, reason: '...' }`
- **THEN** 工具不执行，阻断原因被回填

### Requirement: RuleRegistry

系统 SHALL 提供 `RuleRegistry`，支持 `register`（注册规则实现）、`get`（按 id 查询）、`list`（列出全部）、`forPoint`（按触发节点过滤）。

#### Scenario: 注册与查询

- **WHEN** 注册一个 id 为 `no-destructive` 的规则
- **THEN** `get('no-destructive')` 返回该规则，`forPoint('beforeToolCall')` 含它

### Requirement: 工具节点 guardrail 拦截

Agent Loop SHALL 在工具执行前，对 `on=beforeToolCall` 的规则逐个执行 `validate`；任一返回 `allowed=false` 时，**不执行工具**并回填阻断原因。

#### Scenario: beforeToolCall 阻断

- **WHEN** 某规则在 `beforeToolCall` 返回 `{ allowed: false, reason: '破坏性命令被禁止' }`
- **THEN** 工具不被执行，tool 消息内容含 `Blocked: 破坏性命令被禁止`

#### Scenario: 全部放行

- **WHEN** 所有 `beforeToolCall` 规则返回 `allowed=true`
- **THEN** 工具正常执行

### Requirement: 阻断回填不中止循环

guardrail 阻断 SHALL 回填阻断原因后**继续循环**（而非终止），由模型决定下一步。

#### Scenario: 阻断后模型可调整

- **WHEN** 工具被 guardrail 阻断
- **THEN** 循环继续，模型收到 `Blocked: <reason>` 可调整策略，`maxSteps` 兜底

### Requirement: afterToolCall guardrail

Agent Loop SHALL 在工具执行后，对 `on=afterToolCall` 的规则执行 `validate`；阻断时回填原因（结果不回填）。

#### Scenario: afterToolCall 阻断

- **WHEN** 某规则在 `afterToolCall` 返回 `{ allowed: false, reason }`
- **THEN** 工具结果被替换为阻断原因回填
