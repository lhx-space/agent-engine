## ADDED Requirements

### Requirement: 流式 chat 面板

前端 SHALL 提供长对话 chat 面板：多轮消息列表，assistant 消息经 `react-markdown` + `remark-gfm` 渲染。

#### Scenario: 多轮消息

- **WHEN** 用户连续发送多条消息
- **THEN** 消息按时间顺序展示，user / assistant 分明

#### Scenario: markdown 渲染

- **WHEN** assistant 回复包含 markdown（标题 / 列表 / 代码块）
- **THEN** 内容按 markdown 渲染

### Requirement: NDJSON 流式消费

前端 SHALL 通过 `fetch` + `res.body.getReader()` 消费 `/api/agent/run/stream` 的 NDJSON 事件流，逐行解析事件。

#### Scenario: 逐行解析

- **WHEN** 服务端逐行推送事件
- **THEN** 前端按行解析并分派（step / delta / tool / hook / done / error）

#### Scenario: 跨 chunk 断行

- **WHEN** 一个 JSON 事件被拆到两个网络 chunk
- **THEN** 前端行缓冲拼接后仍能正确解析

### Requirement: 流式渲染节流

流式文本 SHALL 先入 buffer，经 `requestAnimationFrame` 节流批量 flush 到渲染层（每帧最多一次更新）。

#### Scenario: 每帧一次渲染

- **WHEN** 一帧内收到多个 `llm_delta` 事件
- **THEN** 合并为一次渲染更新

### Requirement: 步骤时间线

`tool_call` / `tool_result` / `hook` 事件 SHALL 累积为消息的步骤列表，可折叠展示（含工具名、hook 点、耗时、是否改写）。

#### Scenario: 工具步骤可见

- **WHEN** 运行触发工具调用
- **THEN** 该消息下方展示工具名与结果

#### Scenario: hook 步骤可见

- **WHEN** hook 在某个点执行
- **THEN** 展示 hook 名、触发点、耗时、是否改写
