## Why

core 里的 guardrail 还是「具体实现」而不是「协议」：`RuleRegistry`（内部 `Map` 存规则 + `register/get/list/forPoint` 一套管理逻辑）与 `compileGuardrails`（把 `config.guardrails` 编译为可执行规则）都躺在 core。这违背目标架构「core 只留协议 + 引擎，能力实现外放」。

本 change 把 guardrail 协议化：core 只留 `GuardrailRule` 接口（协议）与 `AgentLoop` 的拦截机制；规则管理与声明式编译外放为 `@lhx-agent-engine/plugin-guardrails`。同时把 core 的 `rules/` 目录正名为 `guardrails/`，与「规则能力已外放 `plugin-rules`」区分开。

## What Changes

- **core 协议化**：删除 `RuleRegistry` 类；`AgentLoop` / `assembleAgentLoop` / `AgentLoopOptions` 的 `guardrails` 从 `RuleRegistry` 改为 `GuardrailRule[]`（core 只认协议，按 `on` 过滤校验）。
- **外放 `@lhx-agent-engine/plugin-guardrails`**：`compileGuardrails` / `createDeclarativeGuardrail` 迁入，新增 `createGuardrailsPlugin(configs)`（`install` 里编译 + `ctx.registerGuardrail`）。
- **目录正名**：`core/src/rules/` → `core/src/guardrails/`；测试 `rules.test.ts` → `guardrails.test.ts`；core 子路径导出 `./rules` → `./guardrails`。
- **config 零迁移（D1-A）**：`config.guardrails` 字段不变，解释权移交 `@lhx-agent-engine/plugin-guardrails`。

## Capabilities

### New Capabilities

- `plugin-guardrails`: `@lhx-agent-engine/plugin-guardrails` 提供 `createGuardrailsPlugin(configs)`，把 `config.guardrails` 编译为 `GuardrailRule[]` 并注册。

### Modified Capabilities

- `rules-engine`: 移除 `RuleRegistry` 与「声明式 guardrail 编译」需求（前者由 `GuardrailRule[]` 协议取代，后者迁至 `plugin-guardrails`）；`GuardrailRule` 接口与 `AgentLoop` 拦截机制不变。

## Impact

- 新增 `packages/plugins/plugin-guardrails/`（package.json / tsconfig / tsdown / src / tests / README）。
- 修改 `packages/core/src/guardrails/{index,types}.ts`（删 registry/declarative）、`agent/{loop,assemble,types}.ts`、`resolve/resolve.ts`、`index.ts`、`types.ts`、`tsdown.config.ts`、`package.json`。
- 迁移 `packages/core/tests/{guardrails,resolve}.test.ts`；删除 `declarative-guardrail.test.ts`。
- 兼容性：`config.guardrails` 字段不变；`registerGuardrail` 协议不变。
