## MODIFIED Requirements

### Requirement: 语义召回长期记忆（LongTermMemory / SemanticMemory）

系统 SHALL 定义 `LongTermMemory` 接口（`name` + `remember(text)` / `recall(query, topK?)` → 召回文本数组）与 `noopLongTermMemory` 默认（`remember` 空、`recall` 返回空数组）。语义实现（`SemanticMemory`）SHALL 已外放为 `@agent-engine/plugin-memory`，由组合层注入；`assemble` SHALL 以「注入的 `longTermMemory` 或 no-op 默认」装配，core 不再持有语义实现。

#### Scenario: 无注入时 no-op 默认

- **WHEN** `assemble` 未注入 `longTermMemory` 时 run
- **THEN** `recall` 返回空、`remember` 不写，不抛错

#### Scenario: 注入实现时走协议

- **WHEN** 注入一个自定义 `LongTermMemory` 实现后 run
- **THEN** `AgentLoop` 按协议 `recall` 注入 system prompt、正常结束 `remember` 写回
