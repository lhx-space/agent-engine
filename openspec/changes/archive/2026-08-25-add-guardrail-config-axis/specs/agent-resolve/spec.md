## ADDED Requirements

### Requirement: guardrail 装配

`resolveAgentConfig` SHALL 在装配时把「插件注册的 guardrail（`merged.guardrails`）」与「`config.guardrails` 编译出的声明式 guardrail」合并进同一 `RuleRegistry`，注入 `AgentLoop`，使声明式安全拦截在工具执行前/后生效；无任何 guardrail 时循环仍正常运行。

#### Scenario: 声明式 guardrail 生效

- **WHEN** 配置声明 `guardrails: [{ id: 'deny-bash', denyTools: ['builtin.bash'] }]` 并经 `resolveAgentConfig` 装配
- **THEN** 模型调用 `builtin.bash` 时被阻断，工具结果回填 `Blocked: ...`

#### Scenario: 插件与声明式并存

- **WHEN** 插件经 `registerGuardrail` 注册一条规则、配置又声明一条
- **THEN** 两条规则都在 `RuleRegistry` 中，各自按 `on` 节点生效
