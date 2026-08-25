## ADDED Requirements

### Requirement: 长期记忆召回与写回

Agent Loop SHALL 支持注入 `longTermMemory`（可选）；每次 `run` 开始时经 `recall(userInput)` 召回相关长期记忆，非空时作为 `[长期记忆]` 片段注入 system prompt；正常结束时把本轮（用户输入 + 最终答案）经 `remember` 写回。异常路径 SHALL 不写回。

#### Scenario: 召回注入

- **WHEN** 注入 `longTermMemory` 且 `recall` 返回非空
- **THEN** 构造 LLM 入参的 system prompt 含 `[长期记忆]` 片段与召回文本

#### Scenario: 正常结束写回

- **WHEN** 注入 `longTermMemory` 且 `run` 正常结束
- **THEN** `remember` 被调用一次（用户输入 + 最终答案）

#### Scenario: 异常不写回

- **WHEN** `run` 抛错
- **THEN** `remember` 不被调用
