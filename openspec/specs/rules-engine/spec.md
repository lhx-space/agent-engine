# rules-engine Specification

## Purpose

TBD - created by archiving change add-rules-engine. Update Purpose after archive.

## Requirements

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

### Requirement: 声明式 guardrail 编译

系统 SHALL 提供 `compileGuardrails(configs)`，把声明式 `GuardrailRuleConfig[]` 编译为可执行的 `GuardrailRule[]`（保持 `id` / `on`）。编译产物的 `validate(ctx)` SHALL 按以下优先级判定：① `denyTools` 命中 `ctx.toolName` → 阻断；② `allowTools` 非空且 `ctx.toolName` 不在其中 → 阻断；③ 任一 `denyPatterns` 正则命中 `ctx.args ?? ctx.result` → 阻断；否则放行。正则 SHALL 在编译期即 `new RegExp`（非法正则在装配时抛可读错误）。

#### Scenario: denyTools 阻断

- **WHEN** 规则 `denyTools: ['builtin.bash']` 且工具名为 `builtin.bash`
- **THEN** `validate` 返回 `{ allowed: false }`，`reason` 含被拒绝的工具名

#### Scenario: allowTools 白名单阻断

- **WHEN** 规则 `allowTools: ['builtin.todo']` 且工具名为 `builtin.bash`
- **THEN** `validate` 返回 `{ allowed: false }`

#### Scenario: allowTools 白名单放行

- **WHEN** 规则 `allowTools: ['builtin.todo']` 且工具名为 `builtin.todo`
- **THEN** `validate` 返回 `{ allowed: true }`

#### Scenario: denyPatterns 命中入参

- **WHEN** 规则 `denyPatterns: ['rm -rf']` 且 `ctx.args` 含 `rm -rf`
- **THEN** `validate` 返回 `{ allowed: false }`

#### Scenario: denyPatterns 命中结果（afterToolCall）

- **WHEN** 规则 `on: 'afterToolCall'`、`denyPatterns: ['password']` 且 `ctx.result` 含 `password`
- **THEN** `validate` 返回 `{ allowed: false }`

#### Scenario: 全部放行

- **WHEN** 规则无任何命中
- **THEN** `validate` 返回 `{ allowed: true }`
