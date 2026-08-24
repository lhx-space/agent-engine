## ADDED Requirements

### Requirement: NDJSON 流式端点

系统 SHALL 提供 `POST /api/agent/run/stream`：接收 `{ config, input }`，以 NDJSON（`application/x-ndjson`）逐行推送运行时事件。

#### Scenario: 流式返回事件

- **WHEN** 发起流式运行请求
- **THEN** 响应为 NDJSON，每行一个 JSON 事件，最终包含 `done` 事件

#### Scenario: 错误事件

- **WHEN** 运行失败
- **THEN** 流中包含 `error` 事件，含错误信息

### Requirement: 结构化日志

server SHALL 使用 pino 记录每次运行的关键事件（启动、step、tool 调用、错误），替代散落的 console 输出。

#### Scenario: 运行打日志

- **WHEN** 一次运行产生事件
- **THEN** 对应事件以结构化日志输出
