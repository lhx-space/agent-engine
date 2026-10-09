## MODIFIED Requirements

### Requirement: 配置一键装配（resolveAgentConfig）

`resolveAgentConfig` SHALL 按 `config.session.store` 解析并装配对话历史后端（解析规则与 `memory.longTerm.backend` / `cache.backend` 一致：未注册或缺省时回退 `InMemoryConversationStore`），并在返回的 `ResolvedAgent` 上暴露 `conversationStore`，使宿主无需接触插件即可读写历史。

#### Scenario: 装配后宿主可直接读历史

- **WHEN** `resolveAgentConfig` 完成且配置声明 `session.store: pg`
- **THEN** `resolved.conversationStore` 为 pg 实现，可直接调用 `listMessages`

#### Scenario: 未注册实现时安全回退

- **WHEN** 配置声明 `session.store: pg` 但无插件注册该名
- **THEN** 回退到 `InMemoryConversationStore` 并发出告警事件，不抛错
