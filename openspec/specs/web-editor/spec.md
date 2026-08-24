# web-editor Specification

## Purpose

TBD - created by archiving change web-editor. Update Purpose after archive.

## Requirements

### Requirement: 三栏编辑器布局

系统 SHALL 提供 WebApp 三栏编辑器：左栏 system-prompt、中栏其他配置、右栏测试 agent。

#### Scenario: 三栏渲染

- **WHEN** 打开 WebApp
- **THEN** 页面分为左（system-prompt）、中（model 配置）、右（测试 agent）三栏

### Requirement: 单一事实来源

WebApp SHALL 复用 `@agent-engine/config` 的 `AgentConfigSchema` 与 `AgentConfig` 类型作为配置状态与校验的唯一来源。

#### Scenario: 复用 config 类型

- **WHEN** 前端定义配置状态
- **THEN** 状态类型为 `AgentConfig`，校验用 `AgentConfigSchema`，不手写第二份类型

### Requirement: systemPrompt 编辑（左栏）

左栏 SHALL 编辑 `systemPrompt.template` 与 `systemPrompt.variables`（键值对增删改）。

#### Scenario: 编辑 template 与 variables

- **WHEN** 在左栏修改 template 文本或增删 variables 键值
- **THEN** 对应更新配置状态的 `systemPrompt` 字段

### Requirement: model 配置（中栏）

中栏 SHALL 编辑 `model` 的 `provider` / `baseURL` / `model` / `temperature` / `maxTokens`。

#### Scenario: 编辑 model 字段

- **WHEN** 在中栏修改 model 各字段
- **THEN** 对应更新配置状态的 `model` 字段

### Requirement: 测试 agent（右栏）

右栏 SHALL 提供输入框，点击运行后调用 `POST /api/agent/run`（body 为 `{ config, input }`），展示 `finalMessage.content` 与 `steps`；失败时展示 `{ error, details }`。

#### Scenario: 运行成功展示结果

- **WHEN** 输入内容并运行，server 返回 200
- **THEN** 展示最终回答文本与步数

#### Scenario: 运行失败展示错误

- **WHEN** server 返回 400/500
- **THEN** 展示 `error` 与 `details`

### Requirement: dev 代理

Rsbuild dev server SHALL 将 `/api` 请求代理到 `http://localhost:8080`。

#### Scenario: 代理转发

- **WHEN** 前端 `fetch('/api/agent/run')`
- **THEN** 请求被转发到本机 8080 的 server

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
