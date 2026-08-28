# context-assembly Specification

## Purpose

TBD - created by archiving change add-context-assembly. Update Purpose after archive.

## Requirements

### Requirement: 模板渲染

系统 SHALL 提供 `renderTemplate(template, variables)`，将模板中的 `{{name}}` 占位符替换为 `variables` 中同名变量的值；未提供的变量 SHALL 保留原样，值为 null / undefined 的变量 SHALL 替换为空串。

#### Scenario: 替换变量

- **WHEN** 模板为 `你好 {{name}}` 且 `variables = { name: '世界' }`
- **THEN** 渲染结果为 `你好 世界`

#### Scenario: 未提供变量保留原样

- **WHEN** 模板含 `{{name}}` 但 `variables` 无该 key
- **THEN** `{{name}}` 原样保留，不替换

#### Scenario: null / undefined 替换为空串

- **WHEN** 模板含 `{{x}}` 且 `variables.x` 为 null 或 undefined
- **THEN** `{{x}}` 替换为空串

### Requirement: system prompt 组装

系统 SHALL 提供 `buildSystemPrompt(options)`，渲染 `systemPrompt.template` 的用户变量，返回本次调用的 system prompt。rules / skills 能力注入已外放为 `@lhx-agent-engine/plugin-rules` / `@lhx-agent-engine/plugin-skills` 的 `ContextContributor`，SHALL 不再占用 `buildSystemPrompt` 的模板占位符。

#### Scenario: 模板渲染用户变量

- **WHEN** 模板含 `{{role}}` 且 `variables.role` 非空
- **THEN** `{{role}}` 被替换为用户变量值，结果不含 `{{role}}` 字面量

#### Scenario: 无用户变量原样返回

- **WHEN** 模板不含占位符
- **THEN** 返回模板原文

### Requirement: Token 预算 / 上下文裁剪接口

系统 SHALL 定义 `TokenCounter` 接口（`name`、`count(text): number`）与 `ContextCompactor` 接口（`name`、`compact(messages, budgetTokens): Promise<ChatMessage[]>`），并提供默认实现 `ApproximateTokenCounter`（字符数/4 粗估）与 `TokenBudgetCompactor`（按 token 预算从头部淘汰整轮，user 起点切轮、不拆散 tool_call 配对）。二者经 `PluginContext.registerTokenCounter` / `registerContextCompactor` 注入，装配层取插件注册的实例（缺省回退默认），随 `ResolvedAgent.tokenCounter` / `contextCompactor` 暴露。

#### Scenario: token 粗估

- **WHEN** 以 `ApproximateTokenCounter` 统计某文本
- **THEN** 返回 `ceil(len/4)` 的粗估 token 数

#### Scenario: 整轮 + token 预算裁剪

- **WHEN** `TokenBudgetCompactor` 裁剪超预算历史（含多轮 user/assistant/tool 交替）
- **THEN** 保留最近整轮，且不拆散 assistant tool_call 与 tool 结果配对

#### Scenario: 插件注入

- **WHEN** 一个 plugin 经 `registerTokenCounter` 注入自定义 tokenizer
- **THEN** `ResolvedAgent.tokenCounter` 为插件实例；未注入时为 `ApproximateTokenCounter`

### Requirement: ContextContributor 统一扩展缝

系统 SHALL 提供 `ContextContributor` 接口（`name` + `contribute({ userInput }) → Promise<{ text?, tools? } | void>`），作为能力向 context 贡献「文本片段 + 临时工具」的统一扩展缝；经 `PluginContext.registerContextContributor` 注册、`CapabilityBundle` 承载、`AgentLoop` 在每次 run 组装前收集。贡献的 `text` SHALL 注入 system prompt，`tools` SHALL 本轮临时注册、run 结束还原；单个贡献者失败 SHALL 隔离（best-effort，不阻断 run）。

#### Scenario: 文本注入

- **WHEN** 一个 contributor 返回 `{ text }`
- **THEN** 该文本被追加进 system prompt

#### Scenario: 工具临时注册与还原

- **WHEN** 一个 contributor 返回 `{ tools }`
- **THEN** run 期间工具注册生效，run 结束（含异常）后还原/移除，不跨 run 残留

#### Scenario: 贡献者失败隔离

- **WHEN** 某 contributor 的 `contribute` 抛错
- **THEN** 跳过该贡献者，其余贡献者与 run 正常继续
