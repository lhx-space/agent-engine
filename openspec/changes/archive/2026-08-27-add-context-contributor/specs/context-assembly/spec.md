## ADDED Requirements

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
