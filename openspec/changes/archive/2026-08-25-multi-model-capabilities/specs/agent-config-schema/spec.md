## ADDED Requirements

### Requirement: embedding 配置

系统 SHALL 定义 `embedding` 子 Schema 为可选对象 `EmbeddingConfigSchema`（`provider` 默认 `openai-compatible`、`baseURL`、`apiKey?`、`model`、`dimension?`）；装配层当 `embedding` 已配置时经 `createEmbeddingProvider` 解析出 `EmbeddingProvider`，随 `ResolvedAgent.embeddingProvider` 暴露（插件注册的 embedding 优先，否则按配置解析）；未配置且无插件注册时为 `undefined`。

#### Scenario: 缺省无 embedding

- **WHEN** 配置未声明 `embedding` 且无插件注册
- **THEN** `ResolvedAgent.embeddingProvider` 为 `undefined`

#### Scenario: 显式 embedding 配置

- **WHEN** 配置声明 `embedding: { baseURL, model }`
- **THEN** 解析出的 `ResolvedAgent.embeddingProvider` 为 openai-compatible 实现，`name` 含模型名

## MODIFIED Requirements

### Requirement: 各配置项 Schema 齐全

系统 SHALL 为 `tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration`、`cache`、`embedding` 分别定义子 Schema，覆盖 AGENTS.md 7.2 节配置示例中的全部字段；其中 `tools` 子 Schema 为 `{ disabled: string[] }`，`cache` 子 Schema 为 `{ backend: string }`，`embedding` 子 Schema 为 `EmbeddingConfigSchema`（见「embedding 配置」需求）。

#### Scenario: 示例配置可通过校验

- **WHEN** 将 AGENTS.md 7.2 节的 devops-agent 示例配置解析为对象并校验
- **THEN** 校验通过，无缺失字段
