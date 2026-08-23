## Context

config 包的 `RuleSchema` 已定义两类规则：`static`（约束文本）与 `guardrail`（在钩子点拦截、可阻断）。hooks 管线（上一 change）已明确「阻断归 rules」。本 change 落地 rules 引擎的**运行时拦截**部分（guardrail），static 规则的 system-prompt 注入留 context 模块。

## Goals / Non-Goals

**Goals:**

- 定义 `GuardrailRule` 接口与 `GuardrailResult`（allowed / reason）。
- 实现 `RuleRegistry`（规则实现注册与查询）。
- Agent Loop 在 `beforeToolCall` / `afterToolCall` 节点执行 guardrail，阻断时回填原因。

**Non-Goals:**

- 不实现 static 规则的 system-prompt 注入——留 context 模块（system-prompt 组装）。
- 不实现配置驱动的规则装配（从 AgentConfig.rules 自动加载到 RuleRegistry）——留装配层。
- 不实现 `beforeLLM` / `afterLLM` 等其他节点的 guardrail——首版只做工具节点。

## Decisions

### D1: 规则「声明 + 实现」分离

**选择**：配置里只有声明（`id` / `kind` / `on`），实现（`validate` 函数）由内置规则或插件通过 `RuleRegistry.register` 提供，按 `id` 匹配。

**理由**：YAML 配置无法表达函数逻辑；声明与实现分离才能「配置即 Agent」——同一个声明可挂不同实现。

### D2: guardrail 阻断 = 回填阻断原因，不中止循环

**选择**：guardrail 返回 `{ allowed: false, reason }` 时，**不执行工具**，把 `Blocked: <reason>` 作为 tool 消息回填，循环继续，由模型调整。

**理由**：与「工具失败回填」语义一致、更鲁棒；直接中止循环过于粗暴，且无法让模型自我修正。

**备选**：直接中止循环。缺点：一个 guardrail 触发即整体失败，且模型无机会调整。**否决**。

### D3: 首版只做工具节点的 guardrail

**选择**：`GuardrailRule.on` 支持 `beforeToolCall` / `afterToolCall`；其他节点（beforeLLM 等）留后续。

**理由**：工具调用是「危险行为」的主要来源（bash、文件写入等），先覆盖最高频的安全场景。

### D4: GuardrailContext 用可选字段

**选择**：`GuardrailContext` 含可选字段 `toolName` / `args` / `result`——`beforeToolCall` 时有 `toolName`/`args`，`afterToolCall` 时有 `toolName`/`result`。

**理由**：同一 context 结构覆盖两个节点，避免两套类型。

## Risks / Trade-offs

- [guardrail 阻断回填导致模型反复尝试被阻断] → `maxSteps` 兜底（已有）。
- [规则实现缺失（配置声明了 id 但没注册实现）] → 装配/运行时发现 `id` 无实现时抛明确错误。

## Migration Plan

无迁移。core 包新增 `rules/` 模块并导出，Agent Loop 在工具节点接入 guardrail 校验。

## Open Questions

- 无（static 注入、配置装配、其他节点 guardrail 均已明确留后续）。
