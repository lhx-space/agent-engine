## ADDED Requirements

### Requirement: tools 配置

系统 SHALL 定义 `tools` 子 Schema 为对象 `{ disabled: string[] }`，`disabled` 缺省为空数组；`disabled` 列出要禁用的工具语义名（builtin.* / plugin / MCP 工具名），装配层在全部工具注册完成后按名移除。旧的无消费方 `ToolRef`（`{ use }`）SHALL 移除。

#### Scenario: 缺省不禁用

- **WHEN** 配置未显式声明 `tools`
- **THEN** 解析后 `tools.disabled` 为空数组，全部内置/plugin 工具照常注册

#### Scenario: 禁用指定内置工具

- **WHEN** 配置声明 `tools: { disabled: ['builtin.web_search'] }`
- **THEN** 解析后 `tools.disabled` 含 `builtin.web_search`，装配完成的 ToolRegistry 不含该工具

## MODIFIED Requirements

### Requirement: 各配置项 Schema 齐全

系统 SHALL 为 `tools`、`mcp`、`skills`、`memory`、`hooks`、`plugins`、`orchestration` 分别定义子 Schema，覆盖 AGENTS.md 7.2 节配置示例中的全部字段；其中 `tools` 子 Schema 为 `{ disabled: string[] }`（见「tools 配置」需求）。

#### Scenario: 示例配置可通过校验

- **WHEN** 将 AGENTS.md 7.2 节的 devops-agent 示例配置解析为对象并校验
- **THEN** 校验通过，无缺失字段
