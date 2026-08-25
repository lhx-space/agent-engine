## ADDED Requirements

### Requirement: guardrails 配置轴

系统 SHALL 定义顶层 `guardrails` 子 Schema（`GuardrailConfigSchema`，数组，缺省 `[]`），每条（`GuardrailRuleConfig`）含 `id`（string）、`on`（枚举 `beforeToolCall` / `afterToolCall`，缺省 `beforeToolCall`）、`allowTools`（string[]，缺省 `[]`）、`denyTools`（string[]，缺省 `[]`）、`denyPatterns`（string[]，正则，缺省 `[]`）。

#### Scenario: 缺省无 guardrail

- **WHEN** 配置未声明 `guardrails`
- **THEN** 解析后 `guardrails` 为空数组，装配出的循环不注入任何声明式 guardrail

#### Scenario: 声明一条 deny 规则

- **WHEN** 配置声明 `guardrails: [{ id: 'deny-rm', denyTools: ['builtin.bash'], denyPatterns: ['rm -rf'] }]`
- **THEN** 校验通过，`on` 缺省为 `beforeToolCall`，`allowTools` 缺省为空数组
