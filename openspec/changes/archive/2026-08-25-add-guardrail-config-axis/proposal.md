## Why

当前 guardrail 只能写「可执行代码」（`GuardrailRule` + `RuleRegistry`），且 `resolveAgentConfig` 装配路径根本没把它接进循环——安全拦截「可执行、但不可配置」。AGENTS.md §2.2 批 C 要求补上「Guardrail 配置轴」：声明式危险操作白/黑名单，配置可热更，延续「配置即 Agent」。

## What Changes

- `config`：新增顶层 `guardrails` 配置轴（`GuardrailConfigSchema`，数组，默认 `[]`）。每条 = `{ id, on（beforeToolCall / afterToolCall）, allowTools, denyTools, denyPatterns }`，纯声明、无代码。
- `core/rules/declarative.ts`：新增 `compileGuardrails(config)` 把声明式配置编译为可执行的 `GuardrailRule[]`（白/黑名单 + 入参/结果正则黑名单）。
- `plugins`：`PluginContext.registerGuardrail` + `CapabilityBundle.guardrails` 汇聚——可执行 guardrail 也走「注入点 + 能力汇聚」两个扩展出口。
- `agent/assemble.ts`：装配时构建 `RuleRegistry`（插件注册的 guardrail + 声明式编译的 guardrail 合并），注入 `AgentLoop`。
- `resolve`：`resolveAgentConfig` 把 `config.guardrails` 传给装配层。

## Capabilities

### New Capabilities

<!-- 无新增能力目录：guardrail 属 rules-engine（执行控制层）既有能力，本 change 只新增「声明式配置轴」这一需求。 -->

### Modified Capabilities

- `agent-config-schema`: 新增顶层 `guardrails` 声明式配置轴（`GuardrailRuleConfigSchema` / `GuardrailConfigSchema`）。
- `rules-engine`: 新增「声明式 guardrail 编译」需求（`compileGuardrails` + 白/黑名单/正则语义）。
- `plugins`: `PluginContext` 新增 `registerGuardrail`，`CapabilityBundle` 新增 `guardrails` 汇聚。
- `agent-resolve`: `resolveAgentConfig` 装配时把插件 guardrail 与声明式 guardrail 合并进 `RuleRegistry` 注入循环。

## Impact

- 新增 `packages/core/src/rules/declarative.ts`。
- 修改 `packages/config/src/schema/index.ts`、`packages/core/src/rules/{index.ts}`、`packages/core/src/plugins/{types,manager}.ts`、`packages/core/src/capability/{types,bundle}.ts`、`packages/core/src/agent/assemble.ts`、`packages/core/src/resolve/resolve.ts`、`packages/core/src/{index,types}.ts`。
- 测试：config schema 解析 / `compileGuardrails` 语义 / plugin `registerGuardrail` 汇聚 / resolve 装配阻断。
- **非破坏**：`guardrails` 缺省 `[]`，不配则行为不变；`AgentLoop` 的 `guardrails`（`RuleRegistry`）接口不变。
