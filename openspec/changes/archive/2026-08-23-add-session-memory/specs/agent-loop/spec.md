## ADDED Requirements

### Requirement: 会话记忆集成

系统 SHALL 支持在 `AgentLoop` 注入 `ConversationMemory`（`memory` 选项，可选）；`run` 时把历史消息拼进 messages（system + 历史 + 当前 user），正常结束时把本轮消息（system 之外）写回 memory；异常时保持 memory 不变。

#### Scenario: 跨 run 累积历史

- **WHEN** 注入 memory 并连续 run 两次
- **THEN** 第二次 run 的 LLM 调用携带第一次 run 的历史消息

#### Scenario: 未注入 memory

- **WHEN** 不注入 memory
- **THEN** 行为与以往一致，无历史累积

#### Scenario: 异常不回写

- **WHEN** run 过程中抛错
- **THEN** memory 保持原历史不变
