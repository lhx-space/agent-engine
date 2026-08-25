## Context

guardrail 是执行控制层的「阻断」职责（hooks 只观察/改写，guardrail 负责阻断）。当前只有可执行形态（`GuardrailRule` + `RuleRegistry`），且 `resolveAgentConfig` 装配路径未把 `RuleRegistry` 接进循环——等于「接口在、消费断、配置轴缺」。批 C 要补「Guardrail 配置轴」：声明式危险操作白/黑名单，配置可热更，且可执行 guardrail 也能经插件注入。

## Goals / Non-Goals

**Goals:**

- 声明式 `guardrails` 配置轴（Zod）+ 编译为 `GuardrailRule` + 装配进循环。
- 可执行 guardrail 走「注入点（`registerGuardrail`）+ 汇聚（`CapabilityBundle.guardrails`）」两个扩展出口。

**Non-Goals:**

- 不做规则 DSL / 复杂条件表达式（如 `and/or/not`）——首版只做白/黑名单 + 正则，够用且可热更。
- 不做「结果归一化 / 重试策略」等批 C 之外的 P3 项。
- 不把 guardrail 塞进 `hooks`（职责分离：观察改写 vs 阻断）。

## Decisions

### D1: `guardrails` 做成顶层配置轴，不塞进 `security` 或 `rules`

**选择**：顶层 `guardrails: GuardrailRuleConfig[]`（缺省 `[]`）。

**理由**：§2.2 明确定义为「Guardrail 配置轴」；与 `tools` / `rules` 等配置轴并列，热更与装配一致。`security.bash.denyPatterns` 是 bash 工具自身策略（软约束），guardrail 是跨工具的通用拦截（硬边界），二者分工不同、不合并。

### D2: 声明式规则编译为 `GuardrailRule`，复用既有循环拦截

**选择**：`compileGuardrails` 产出 `GuardrailRule[]`，装配进 `RuleRegistry`；循环（`forPoint` 校验）零改动。

**理由**：循环已实现「beforeToolCall/afterToolCall 按序校验 + 阻断回填不中止」，声明式只是多一个「来源」，复用同一执行路径，不重复造拦截逻辑。

### D3: 判定优先级 = deny → allow → pattern

**选择**：`denyTools` 命中即阻断；否则 `allowTools` 非空且不含工具名即阻断；否则 `denyPatterns`（正则）命中 `args`（before）/ `result`（after）即阻断；否则放行。

**理由**：deny 优先于 allow（「拒绝优先」安全默认）；pattern 落在 args/result 而非工具名，覆盖「危险命令 / 敏感输出」两类典型场景。正则编译期 `new RegExp`，非法模式装配期报错（fail fast）。

### D4: 与 `tools.disabled` 分工明确

**选择**：`tools.disabled` 在装配末「移除工具」（模型根本拿不到该工具）；guardrail `denyTools`/`allowTools` 在「运行时拦截」（工具仍在、调用被阻断）。

**理由**：前者省 token + 面向「完全不需要」；后者面向「工具要保留（如 bash 仅限某些场景）但需硬边界兜底」，二者互补而非重复。

## Risks / Trade-offs

- [正则 ReDoS / 误匹配] → 首版直接 `RegExp.test`，不引安全正则库；正则由受信任配置提供，生产可再接 guardrail 插件做更强校验。
- [声明式表达能力有限] → 覆盖白/黑名单 + 正则；更复杂逻辑走可执行 `registerGuardrail` 插件，接口已打通。
- [`guardrails` 与 `rules` 同名易混] → 顶层字段 `guardrails`（阻断、可执行/声明式）与 `rules`（上下文注入文本）分离，与既有 `AgentLoop` 字段命名一致。

## Migration Plan

- 无破坏：`guardrails` 缺省 `[]`，不配则行为不变；`AgentLoop` 的 `guardrails: RuleRegistry` 接口不变。
- 后续（可选）：`security.guardrails` 别名、规则 DSL、结果归一化属 P3，另行评估。
