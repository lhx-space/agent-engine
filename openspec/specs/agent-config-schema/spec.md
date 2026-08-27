# agent-config-schema Specification

## Purpose

TBD - created by archiving change add-config-schema. Update Purpose after archive.

## Requirements

### Requirement: AgentConfig 顶层结构

系统 SHALL 定义 `AgentConfig` 的 Zod Schema，包含 `name`、`description`、`version`、`model`、`systemPrompt`、`rules`、`tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration`、`execution`、`security` 字段，并通过 `z.infer` 衍生 TS 类型。

#### Scenario: 合法配置校验通过

- **WHEN** 一份包含必需字段的配置对象传入 `AgentConfigSchema.parse()`
- **THEN** 返回类型为 `AgentConfig` 的对象，无异常

### Requirement: model 配置

系统 SHALL 定义 `model` 子 Schema，含 `provider`（openai-compatible / anthropic / custom）、`baseURL`、`model`、`temperature`、`maxTokens`，并新增可选采样参数 `topP`（0~~1）、`frequencyPenalty`（-2~~2）、`presencePenalty`（-2~2）、`stop`（string[]）、`seed`（int）；`provider` 未显式声明时 SHALL 默认为 `openai-compatible`（DeepSeek）。

#### Scenario: 默认 provider

- **WHEN** 配置未显式声明 `provider`
- **THEN** 解析结果的 `provider` 为 `openai-compatible`

#### Scenario: 采样参数声明

- **WHEN** 配置声明 `model.topP=0.7`、`frequencyPenalty=0.3`、`presencePenalty=0.1`、`stop=['\n']`、`seed=42`
- **THEN** 校验通过，各字段按声明解析

#### Scenario: 越界采样参数拒绝

- **WHEN** 配置声明 `model.topP=2` 或 `model.frequencyPenalty=3`
- **THEN** 校验失败（Zod 范围约束生效）

### Requirement: rules 配置

系统 SHALL 定义 `rules` 子 Schema，每条规则含 `id`、`kind`（always / on-demand，加载策略）、`description`（meta 匹配面）、`content`（markdown 正文）、`tags`（同义词数组）；`kind` 未显式声明时 SHALL 默认为 `on-demand`。

#### Scenario: always 规则

- **WHEN** 一条 `kind='always'` 的规则
- **THEN** 该规则加载时强制注入，绕过检索

#### Scenario: on-demand 规则默认值

- **WHEN** 一条规则未声明 `kind`
- **THEN** 解析后 `kind` 为 `on-demand`，参与检索

#### Scenario: 规则含 content 与 tags

- **WHEN** 一条规则声明 `description`、`content`、`tags`
- **THEN** 校验通过，`tags` 作为同义词参与检索索引

### Requirement: 各配置项 Schema 齐全

系统 SHALL 为 `tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration`、`cache`、`embedding` 分别定义子 Schema，覆盖 AGENTS.md 7.2 节配置示例中的全部字段；其中 `tools` 子 Schema 为 `{ disabled: string[] }`，`cache` 子 Schema 为 `{ backend: string }`，`embedding` 子 Schema 为 `EmbeddingConfigSchema`（见「embedding 配置」需求）。

#### Scenario: 示例配置可通过校验

- **WHEN** 将 AGENTS.md 7.2 节的 devops-agent 示例配置解析为对象并校验
- **THEN** 校验通过，无缺失字段

### Requirement: security 配置

系统 SHALL 定义 `security` 子 Schema，含 `sandbox`（`backend` 默认 `auto`、`image` 默认 `agent-engine/sandbox`、`workspaceRoot`、`compact` 默认 `false`）、`bash`（`enabled` 默认 `false`、`allowCommands`、`denyPatterns`、`allowNetwork` 默认 `false`、`timeoutMs`、`maxOutputBytes`）、`files`（`roots`、`maxFileBytes`）、`webSearch`（`provider` 枚举 `searxng` / `duckduckgo` / `tavily` / `serper`，默认 `searxng`；`endpoint` SearXNG baseURL；`apiKey` tavily/serper key；`fallback` 默认 `duckduckgo`；`maxResults`；`timeoutMs`）、`webFetch`（`allowDomains`、`denyDomains`、`timeoutMs`、`maxOutputBytes`）。

#### Scenario: webSearch provider 默认

- **WHEN** 配置未声明 `security.webSearch`
- **THEN** 解析后 `webSearch.provider` 为 `searxng`、`fallback` 为 `duckduckgo`、`maxResults` 为默认值

#### Scenario: webSearch 显式 endpoint 与 apiKey

- **WHEN** 配置 `webSearch.endpoint` 与 `webSearch.apiKey`
- **THEN** 解析后二者被保留，供对应 provider 使用

### Requirement: execution 配置

系统 SHALL 定义顶层 `execution` 子 Schema（可选），含 `maxSteps`（int positive，默认 10）、`maxToolCalls`（int positive，可选，默认无限制）、`timeoutMs`（int positive，可选，默认无限制）、`toolRetry`（`maxRetries` int 非负默认 0、`baseDelayMs` int 非负默认 500）、`maxContinuations`（int 非负默认 1）；未声明时 SHALL 使用上述默认值，行为与现状一致。

#### Scenario: execution 缺省对齐现状

- **WHEN** 配置未声明 `execution`
- **THEN** 解析后 `execution.maxSteps` 为 10、`toolRetry.maxRetries` 为 0、`maxContinuations` 为 1

#### Scenario: 显式覆盖预算

- **WHEN** 配置声明 `execution.maxSteps=20` 与 `execution.toolRetry.maxRetries=2`
- **THEN** 校验通过，预算与重试按声明解析

### Requirement: tools 配置

系统 SHALL 定义 `tools` 子 Schema 为对象 `{ disabled: string[] }`，`disabled` 缺省为空数组；`disabled` 列出要禁用的工具语义名（builtin.* / plugin / MCP 工具名），装配层在全部工具注册完成后按名移除。旧的无消费方 `ToolRef`（`{ use }`）SHALL 移除。

#### Scenario: 缺省不禁用

- **WHEN** 配置未显式声明 `tools`
- **THEN** 解析后 `tools.disabled` 为空数组，全部内置/plugin 工具照常注册

#### Scenario: 禁用指定内置工具

- **WHEN** 配置声明 `tools: { disabled: ['builtin.web_search'] }`
- **THEN** 解析后 `tools.disabled` 含 `builtin.web_search`，装配完成的 ToolRegistry 不含该工具

### Requirement: cache 配置

系统 SHALL 定义 `cache` 子 Schema 为可选对象 `{ backend: string }`，`backend` 默认 `in-memory`；装配层按 `cache.backend` 名字解析 `CacheBackend`（内置 `in-memory` + 插件注册的后端），未注册名字抛可读错误。

#### Scenario: 缺省 cache

- **WHEN** 配置未声明 `cache`
- **THEN** 解析出的缓存后端为 `in-memory`

#### Scenario: 显式 cache.backend

- **WHEN** 配置声明 `cache: { backend: 'redis' }`（redis 已由插件注册）
- **THEN** 解析出的缓存后端为插件注册的 redis 实例

### Requirement: embedding 配置

系统 SHALL 定义 `embedding` 子 Schema 为可选对象 `EmbeddingConfigSchema`（`provider` 默认 `openai-compatible`、`baseURL`、`apiKey?`、`model`、`dimension?`）；装配层当 `embedding` 已配置时经 `createEmbeddingProvider` 解析出 `EmbeddingProvider`，随 `ResolvedAgent.embeddingProvider` 暴露（插件注册的 embedding 优先，否则按配置解析）；未配置且无插件注册时为 `undefined`。

#### Scenario: 缺省无 embedding

- **WHEN** 配置未声明 `embedding` 且无插件注册
- **THEN** `ResolvedAgent.embeddingProvider` 为 `undefined`

#### Scenario: 显式 embedding 配置

- **WHEN** 配置声明 `embedding: { baseURL, model }`
- **THEN** 解析出的 `ResolvedAgent.embeddingProvider` 为 openai-compatible 实现，`name` 含模型名

### Requirement: guardrails 配置轴

系统 SHALL 定义顶层 `guardrails` 子 Schema（`GuardrailConfigSchema`，数组，缺省 `[]`），每条（`GuardrailRuleConfig`）含 `id`（string）、`on`（枚举 `beforeToolCall` / `afterToolCall`，缺省 `beforeToolCall`）、`allowTools`（string[]，缺省 `[]`）、`denyTools`（string[]，缺省 `[]`）、`denyPatterns`（string[]，正则，缺省 `[]`）。

#### Scenario: 缺省无 guardrail

- **WHEN** 配置未声明 `guardrails`
- **THEN** 解析后 `guardrails` 为空数组，装配出的循环不注入任何声明式 guardrail

#### Scenario: 声明一条 deny 规则

- **WHEN** 配置声明 `guardrails: [{ id: 'deny-rm', denyTools: ['builtin.bash'], denyPatterns: ['rm -rf'] }]`
- **THEN** 校验通过，`on` 缺省为 `beforeToolCall`，`allowTools` 缺省为空数组

### Requirement: memory.session 配置轴

系统 SHALL 定义 `memory.session` 子 Schema，含 `maxMessages`（int positive，可选）、`maxTokens`（int positive，可选，token 预算）、`summary`（boolean，默认 false，滚动摘要开关）；`summary` 未声明时 SHALL 默认为 false。

#### Scenario: 缺省不开摘要

- **WHEN** 配置声明 `memory: { session: { maxTokens: 4096 } }`
- **THEN** 解析后 `summary` 为 false、`maxTokens` 为 4096

#### Scenario: 显式开启摘要

- **WHEN** 配置声明 `memory: { session: { summary: true } }`
- **THEN** 解析后 `summary` 为 true

### Requirement: beforeContextCompose hook point

`HookPointSchema` SHALL 新增 `beforeContextCompose` 枚举值，允许在 `hooks` 配置里声明该钩子点。

#### Scenario: 配置声明

- **WHEN** 配置 `hooks: [{ plugin: 'x', on: ['beforeContextCompose'] }]`
- **THEN** 校验通过，装配后该 hook 在组合前触发

### Requirement: documents 配置轴

`AgentConfig` SHALL 提供可选 `documents` 配置：`sources`（路径数组，文件或目录）、`chunking`（`strategy: fixed | heading`、`size`、`overlap`）、`topK`（检索数量，默认 4）。

#### Scenario: 声明文档源

- **WHEN** 配置含 `documents.sources: ['./knowledge']`
- **THEN** 装配时装载该目录文档并建立索引
