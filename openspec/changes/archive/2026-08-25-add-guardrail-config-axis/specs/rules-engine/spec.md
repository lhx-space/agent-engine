## ADDED Requirements

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
