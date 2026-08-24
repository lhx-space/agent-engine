## MODIFIED Requirements

### Requirement: 窗口裁剪

系统 SHALL 支持 `maxMessages` 限制；历史条数超过 `maxMessages` 时，按「整轮边界」从头部淘汰（裁剪点对齐到 `user` 消息起点），保证不拆散 assistant `tool_call` 与其后的 `tool` 结果配对；未设置或非正数时不裁剪。

#### Scenario: 超限按整轮边界淘汰

- **WHEN** `maxMessages=3` 且历史为两轮 `[u1, a1, u2, a2]`
- **THEN** 从头部淘汰到最近轮次起点，保留 `[u2, a2]`

#### Scenario: 不拆散 tool_call 配对

- **WHEN** 裁剪点落在 assistant（含 tool_calls）与其 tool 结果之间
- **THEN** 裁剪点后移对齐到下一个 `user` 起点，整组一起保留或一起淘汰，不产生孤立 tool 消息

#### Scenario: 未设置不裁剪

- **WHEN** 未设置 `maxMessages`
- **THEN** 历史无限累积，不裁剪
