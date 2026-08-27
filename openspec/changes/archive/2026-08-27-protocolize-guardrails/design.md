## Context

guardrail 的「机制」（工具执行前后拦截）属于内核「怎么拦截」；但 `RuleRegistry`（注册表）与 `compileGuardrails`（声明式编译）是「能力实现」，不该留在 core。目标是把二者协议化/外放，与 `plugin-rules` 外放对称。

## Goals / Non-Goals

**Goals:**

- core 只留 `GuardrailRule` 接口 + `AgentLoop` 拦截机制 + `registerGuardrail` 协议。
- `RuleRegistry` 删除，`AgentLoop` 依赖 `GuardrailRule[]`（按 `on` 过滤）。
- 声明式编译外放为 `@agent-engine/plugin-guardrails`。
- `rules/` 目录正名 `guardrails/`。

**Non-Goals:**

- 不改 `GuardrailRule` 接口形状（`{ id, on, validate }`）。
- 不改拦截语义（deny → allow → pattern 优先级不变）。
- 不改 `config.guardrails` schema。

## Decisions

### D1: `AgentLoop` 依赖 `GuardrailRule[]` 而非注册表类

**选择**：`AgentLoop.guardrails: GuardrailRule[]`；拦截时 `filter(rule => rule.on === point)`。

**理由**：注册表类（Map + register/get/list/forPoint）是「管理实现」，core 只需「协议 + 遍历」。规则来源的合并（预置 + 插件注册）在装配层用数组拼接完成，core 不再持有任何 guardrail 管理状态。

### D2: 声明式编译外放为 `plugin-guardrails`（对称 `plugin-rules`）

**选择**：`createGuardrailsPlugin(configs: GuardrailRuleConfig[])` 返回 `Plugin`，`install` 里 `compileGuardrails(configs).forEach(ctx.registerGuardrail)`。

**理由**：`config.guardrails` 是「声明式配置 → 可执行规则」的解释逻辑，属于能力（D1-A：字段不变、解释权移交插件）。与 `plugin-rules` 解释 `config.rules` 完全对称。装配（谁调用工厂）延后到 Phase 4 preset-default。

### D3: 目录正名 `rules/` → `guardrails/`

**选择**：core 子路径 `./rules` 改为 `./guardrails`，测试 `rules.test.ts` 改 `guardrails.test.ts`。

**理由**：目录里现在只剩 guardrail（`GuardrailRule` + 拦截），叫 `rules` 会与「规则能力已外放 `plugin-rules`」混淆。

## Risks / Trade-offs

- [声明式 guardrail 暂时失效] `config.guardrails` 的解释外放后，在 Phase 4 preset-default 装配 `plugin-guardrails` 前，直接 `resolveAgentConfig` 不再自动编译声明式 guardrail（需显式传入 `plugin-guardrails` 或经 preset）。这是能力外放的过渡态，符合 plan（Phase 2 迁包、Phase 4 装配）。
- [API 破坏] `RuleRegistry` 类删除、`guardrails` 选项类型从类变数组，是 breaking change；仓库内同步更新调用方与测试。
