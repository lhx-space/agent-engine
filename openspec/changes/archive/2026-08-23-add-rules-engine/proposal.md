## Why

hooks 管线（上一 change）明确了职责边界：**hooks 只「观察 + 改写」，不做阻断；阻断是 rules 的职责**。但 rules 这一层还没有落地——config Schema 里已经定义了 `RuleSchema`（static / guardrail 两类），却没有任何运行时机制去执行它。

具体缺口：guardrail 规则（如「禁止执行破坏性命令」）需要在 `beforeToolCall` 等节点**校验并阻断**危险行为，这是安全关键能力。没有它，Agent 无法被约束，垂直领域 Agent 的「约束与规则」配置形同虚设。

## What Changes

- 定义 `GuardrailRule` 接口：`id` + `on`（触发节点）+ `validate(ctx)` → `GuardrailResult`（allowed / reason）。
- 实现 `RuleRegistry`：注册 / 查询规则实现（内置规则 + 插件注册）。
- Agent Loop 集成：在 `beforeToolCall` / `afterToolCall` 节点执行匹配的 guardrail，阻断时**回填阻断原因**（不中止循环，让模型可调整）。
- 明确「规则声明（配置）与规则实现（代码）分离」：配置声明 `id`/`kind`/`on`，代码通过 `id` 提供实现。

## Capabilities

### New Capabilities

- `rules-engine`: `GuardrailRule` 接口、`RuleRegistry`、guardrail 拦截（阻断回填）。

### Modified Capabilities

<!-- 无：agent-loop 的 requirement 不变，仅在工具执行前接入 guardrail 校验 -->

## Impact

- 新增 `packages/core/src/rules/`（GuardrailRule 接口 + RuleRegistry）。
- 修改 `packages/core/src/agent/loop.ts`（工具执行前接入 guardrail 校验）。
- 依赖：无新增三方依赖。
- 新增 `packages/core/tests/` 下的单元测试。
- 无 breaking changes。
