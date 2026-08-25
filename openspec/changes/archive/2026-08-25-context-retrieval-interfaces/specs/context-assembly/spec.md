## ADDED Requirements

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
