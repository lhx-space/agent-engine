## Context

retrieval 链路（`RuleLoader` + `buildSystemPrompt`）已就绪，但 AgentLoop 内部不调用检索，只能靠调用方把 `buildSystemPrompt` 包装成函数式 `systemPrompt`。这违背「配置即 Agent」——内建检索后，传模板 + rules 即可开箱多轮。

## Goals / Non-Goals

**Goals:**

- `SystemPromptInput` 支持模板对象（`SystemPrompt`），AgentLoop 内建「渲染 + 检索注入」。
- 收口字段语义：`rules` = 上下文规则，`guardrails` = 安全拦截，与 AGENTS.md 5.3 对齐。

**Non-Goals:**

- 不内建 skills / mcp / plugins 的检索（5.5 后续推广，本次仅 rules）。
- 不改 `RuleLoader` / `buildSystemPrompt` 本身（复用现有实现）。
- 不做 config 装配层（`AgentConfig` → `AgentLoop` 的完整自动装配仍留后续 resolve 模块）。

## Decisions

### D1: systemPrompt 三形态，模板对象走内建检索

**选择**：`SystemPromptInput = string | SystemPrompt | 函数`。模板对象时，AgentLoop 内部调 `buildSystemPrompt(userInput, { systemPrompt, ruleLoader })`。

**理由**：三种形态覆盖全部场景——静态（无状态提示）、模板（声明式组装，默认体验）、函数（完全自定义）。函数式仍保留，不破坏解耦能力。

### D2: rules 让位上下文规则，guardrail 改名 guardrails

**选择**：`AgentLoopOptions.rules?: Rule[]`（上下文规则）；`guardrails?: RuleRegistry`（安全拦截）。

**理由**：八大可配置项里 `rules` 本义是「上下文规则」，guardrail 是独立安全机制（AGENTS.md 5.3）。改名消除命名冲突，代码与文档一致。

**备选**：保留 `rules` 为 guardrail、上下文规则另起名（如 `contextRules`）。缺点：与「配置即 Agent」的 `rules` 语义背道而驰，且与 5.3 文档矛盾。**否决**。

### D3: RuleLoader 在构造函数预构建

**选择**：`rules` 非空时构造 `RuleLoader` 一次并缓存；run 时复用。

**理由**：避免每次 run 重复注册 CapabilityRegistry（重建索引），性能与一致性更好。

## Risks / Trade-offs

- [guardrails 改名] → 内部 API 变更，未发布无外部影响；rules.test.ts 已同步。
- [模板对象 + rules 的隐含依赖] → 模板对象必须配 rules 才有检索效果；无 rules 时仅渲染变量（`buildSystemPrompt` 已兜底空串）。
- [函数式仍可覆盖] → 函数式 systemPrompt 与 rules 字段互斥（函数完全自定义，rules 被忽略），语义已注释说明。

## Migration Plan

`AgentLoopOptions.rules`（旧 guardrail）→ `guardrails`；`rules` 新语义为上下文规则。仓库内 rules.test.ts 已同步，无外部迁移。
