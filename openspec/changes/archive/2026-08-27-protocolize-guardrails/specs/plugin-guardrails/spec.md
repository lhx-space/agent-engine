## ADDED Requirements

### Requirement: createGuardrailsPlugin 注册 GuardrailRule

系统 SHALL 提供 `@lhx-agent-engine/plugin-guardrails` 包，导出 `createGuardrailsPlugin(configs)`，返回 `Plugin`；其 `install(ctx)` SHALL 把 `configs` 编译为 `GuardrailRule[]` 并逐个调用 `ctx.registerGuardrail` 注入内核拦截机制。

#### Scenario: 安装注册规则

- **WHEN** 以含 denyTools / denyPatterns 的 configs 构造 `createGuardrailsPlugin` 并安装
- **THEN** `registerGuardrail` 被调用，注册的规则数等于 configs 数，且保留各规则 `id` / `on`

#### Scenario: 空配置零注册

- **WHEN** configs 为空数组时安装
- **THEN** 不注册任何规则，不报错

### Requirement: 声明式 guardrail 编译

系统 SHALL 提供 `compileGuardrails(configs)` 与 `createDeclarativeGuardrail(config)`，把声明式 `GuardrailRuleConfig` 编译为可执行 `GuardrailRule`；判定优先级 SHALL 为 ① `denyTools` 命中阻断 → ② `allowTools` 非空且不在内阻断 → ③ `denyPatterns` 正则命中 args/result 阻断 → ④ 放行。正则 SHALL 在编译期 `new RegExp`（非法模式抛可读错误）。

#### Scenario: denyTools 命中阻断

- **WHEN** 规则 `denyTools: ['builtin.bash']` 且 `ctx.toolName` 为 `builtin.bash`
- **THEN** `validate` 返回 `{ allowed: false }`，`reason` 含被拒绝工具名

#### Scenario: allowTools 白名单阻断与放行

- **WHEN** 规则 `allowTools: ['builtin.todo']` 且工具名分别为 `builtin.bash` / `builtin.todo`
- **THEN** 前者返回 `allowed: false`，后者返回 `allowed: true`

#### Scenario: denyPatterns 命中入参 / 结果

- **WHEN** 规则 `denyPatterns: ['rm -rf']` 且 `ctx.args` 含该模式
- **THEN** `validate` 返回 `{ allowed: false }`

#### Scenario: deny 优先于 allow

- **WHEN** 同一规则同时含 `denyTools` 与 `allowTools` 且命中同一工具
- **THEN** 返回 `{ allowed: false }`

#### Scenario: 无命中放行

- **WHEN** 规则无任何命中
- **THEN** `validate` 返回 `{ allowed: true }`

#### Scenario: 非法正则编译期抛错

- **WHEN** `denyPatterns` 含非法正则（如 `(`）
- **THEN** `compileGuardrails` 抛错
