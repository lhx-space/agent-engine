## ADDED Requirements

### Requirement: 思考与回复分开展示

前端 chat 面板 SHALL 区分「思考」与「回复」：`llm_delta` 事件 `kind='reasoning'` 的内容累积为「思考」块（灰显、可折叠），`kind='content'` 的内容累积为回复正文。

#### Scenario: 思考块灰显折叠

- **WHEN** 流式事件含 `kind='reasoning'` 的 `llm_delta`
- **THEN** 该内容展示在折叠的「思考」块中（灰显），不混入回复正文

#### Scenario: 回复正文正常渲染

- **WHEN** 流式事件含 `kind='content'`（或缺省）的 `llm_delta`
- **THEN** 该内容累积为回复正文并 markdown 渲染

#### Scenario: 无思考时行为不变

- **WHEN** 流式事件不含 `kind='reasoning'`
- **THEN** 不显示思考块，行为与以往一致
