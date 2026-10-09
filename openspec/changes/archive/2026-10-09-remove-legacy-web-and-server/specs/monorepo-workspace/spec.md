## MODIFIED Requirements

### Requirement: 单向依赖方向

包依赖 SHALL 遵循 `config ← core ← cli / platform (apps/platform, HTTP API)` 的单向依赖，禁止反向或循环依赖。

#### Scenario: 依赖方向校验

- **WHEN** 检查各包 `package.json` 的 dependencies
- **THEN** `core` 依赖 `config`，`cli` 依赖 `core`，`apps/platform` 通过 HTTP API 调用内核，无环
