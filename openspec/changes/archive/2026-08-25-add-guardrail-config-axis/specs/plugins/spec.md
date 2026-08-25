## ADDED Requirements

### Requirement: guardrail 注入

`PluginContext` SHALL 提供 `registerGuardrail(rule: GuardrailRule)`，插件经它注册可执行 guardrail 规则；`CapabilityBundle` SHALL 含 `guardrails: GuardrailRule[]`，经 `mergeBundles` 汇聚进装配层。

#### Scenario: 插件注册 guardrail

- **WHEN** 插件在 `install` 内调用 `ctx.registerGuardrail(rule)`
- **THEN** 该规则进入 `CapabilityBundle.guardrails`，装配后注入循环的 `RuleRegistry`

#### Scenario: 无插件注册

- **WHEN** 无插件注册 guardrail
- **THEN** `merged.guardrails` 为空数组，装配正常进行
