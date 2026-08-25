## MODIFIED Requirements

### Requirement: 会话记忆集成

系统 SHALL 支持在 `AgentLoop` 注入 `ConversationMemory`（`memory` 选项，可选）；`run` 时经 `await memory.getWindow()` 取回「裁剪 + 摘要后」的历史窗口并拼进 messages（system + 窗口 + 当前 user），正常结束时把本轮消息（system 之外）写回 memory；异常时保持 memory 不变。

#### Scenario: 跨 run 累积历史

- **WHEN** 注入 memory 并连续 run 两次
- **THEN** 第二次 run 的 LLM 调用携带第一次 run 的历史消息

#### Scenario: 历史经 getWindow 取回

- **WHEN** 注入带 token 预算/摘要的 `ConversationMemory` 并 `run`
- **THEN** 构造 LLM 入参的历史来自 `getWindow()`（含摘要头），而非原始全量历史

#### Scenario: 未注入 memory

- **WHEN** 不注入 memory
- **THEN** 行为与以往一致，无历史累积

#### Scenario: 异常不回写

- **WHEN** run 过程中抛错
- **THEN** memory 保持原历史不变
