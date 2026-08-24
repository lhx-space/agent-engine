## MODIFIED Requirements

### Requirement: model 配置（中栏）

中栏 SHALL 编辑 `model` 的 `provider` / `baseURL` / `model` / `temperature` / `maxTokens`，并 SHALL 提供供应商预设（DeepSeek chat / DeepSeek reasoner / Anthropic / Ollama 本地），点选后一键填充 `provider` / `baseURL` / `model`（apiKey 不自动填充，提示经环境变量注入）。

#### Scenario: 编辑 model 字段

- **WHEN** 在中栏修改 model 各字段
- **THEN** 对应更新配置状态的 `model` 字段

#### Scenario: 供应商预设一键填充

- **WHEN** 用户点选「DeepSeek reasoner」预设
- **THEN** `model.provider` / `baseURL` / `model` 被填充为对应值，`apiKey` 保持空

## ADDED Requirements

### Requirement: security 折叠与 preset

security 配置 SHALL 默认折叠展示，并提供 preset（strict / balanced / permissive）快捷填充；展开后仍可细调各字段。

#### Scenario: 默认折叠

- **WHEN** 打开配置面板
- **THEN** security 卡片折叠，不展开显示全部默认字段

#### Scenario: preset 填充

- **WHEN** 点选 permissive preset
- **THEN** 对应安全字段（如 `bash.enabled`）被填充为宽松值

### Requirement: 导出只导非默认值

导出 YAML / JSON SHALL 省略等于默认值的字段（与默认 `AgentConfig` diff），使导出更精简，且回读后语义等价。

#### Scenario: 省略默认字段

- **WHEN** 当前配置的 `security` 等于默认安全配置
- **THEN** 导出内容不含 `security` 字段（或仅含与默认不同的字段）

#### Scenario: 保留非默认值

- **WHEN** 用户修改了某字段（如 `temperature: 0.2`）
- **THEN** 该字段仍出现在导出内容中
