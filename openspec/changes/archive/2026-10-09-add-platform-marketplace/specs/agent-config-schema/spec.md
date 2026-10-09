## ADDED Requirements

### Requirement: AgentConfig Schema 为单一事实来源

`AgentConfigSchema`（Zod）SHALL 继续作为配置的单一事实来源，并 SHALL 支持从 JSON 反序列化：平台存储的 manifest（jsonb）在写入与读取时均经同一 Schema 校验，类型由 `z.infer` 衍生。

Schema 演进 SHALL 保持向后兼容：新增字段可选；对历史 manifest 校验失败时，系统 SHALL 以「只读 + 需升级」降级处理，而非直接报错阻断。

#### Scenario: 从 JSON 还原配置

- **WHEN** 读取平台存储的 manifest jsonb
- **THEN** 经 `AgentConfigSchema` 校验后得到与目录解析一致的 `AgentConfig`

#### Scenario: 历史配置兼容降级

- **WHEN** 某 manifest 与当前 Schema 不兼容
- **THEN** 标记为需升级并允许浏览，不抛出阻断性错误
