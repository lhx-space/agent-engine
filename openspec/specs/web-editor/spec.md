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
