## ADDED Requirements

### Requirement: 配置导出

前端 SHALL 提供「导出配置」能力，把当前 `AgentConfig` 序列化为 YAML 或 JSON 文件并触发浏览器下载。

#### Scenario: 导出 YAML

- **WHEN** 用户选择导出 YAML
- **THEN** 下载名为 `<name>.yaml` 的文件，内容为当前配置的 YAML 序列化

#### Scenario: 导出 JSON

- **WHEN** 用户选择导出 JSON
- **THEN** 下载名为 `<name>.json` 的文件，内容为当前配置的 JSON（缩进 2）

#### Scenario: 可被回读

- **WHEN** 导出的 YAML 交给 `loadAgentConfig` 加载
- **THEN** 解析出的 `AgentConfig` 与前端配置等价
