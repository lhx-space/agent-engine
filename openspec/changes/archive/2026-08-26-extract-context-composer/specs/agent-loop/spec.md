## ADDED Requirements

### Requirement: 上下文组装（ContextComposer）

系统 SHALL 提供 `ContextComposer`，输入 `systemPrompt` / `rules` / `skills` / `memory` / `longTermMemory`，`compose(userInput)` 输出 `Message[]`（system + 会话窗口 + 当前 user）与命中的 skills / 规则文本 / 召回记忆；`AgentLoop.run` SHALL 委托其组装、不再内联拼 messages。

#### Scenario: 组装 messages

- **WHEN** 以含静态 system prompt、会话历史、长期记忆召回的输入调用 `compose`
- **THEN** 返回 messages 依次为 system（含规则/技能/长期记忆片段）、历史、当前 user
