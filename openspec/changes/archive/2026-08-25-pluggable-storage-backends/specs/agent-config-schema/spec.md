## ADDED Requirements

### Requirement: cache 配置

系统 SHALL 定义 `cache` 子 Schema 为可选对象 `{ backend: string }`，`backend` 默认 `in-memory`；装配层按 `cache.backend` 名字解析 `CacheBackend`（内置 `in-memory` + 插件注册的后端），未注册名字抛可读错误。

#### Scenario: 缺省 cache

- **WHEN** 配置未声明 `cache`
- **THEN** 解析出的缓存后端为 `in-memory`

#### Scenario: 显式 cache.backend

- **WHEN** 配置声明 `cache: { backend: 'redis' }`（redis 已由插件注册）
- **THEN** 解析出的缓存后端为插件注册的 redis 实例

## MODIFIED Requirements

### Requirement: 各配置项 Schema 齐全

系统 SHALL 为 `tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration`、`cache` 分别定义子 Schema，覆盖 AGENTS.md 7.2 节配置示例中的全部字段；其中 `tools` 子 Schema 为 `{ disabled: string[] }`（见「tools 配置」需求），`cache` 子 Schema 为 `{ backend: string }`（见「cache 配置」需求）。

#### Scenario: 示例配置可通过校验

- **WHEN** 将 AGENTS.md 7.2 节的 devops-agent 示例配置解析为对象并校验
- **THEN** 校验通过，无缺失字段
