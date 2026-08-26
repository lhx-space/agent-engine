## ADDED Requirements

### Requirement: beforeContextCompose hook point

`HookPointSchema` SHALL 新增 `beforeContextCompose` 枚举值，允许在 `hooks` 配置里声明该钩子点。

#### Scenario: 配置声明

- **WHEN** 配置 `hooks: [{ plugin: 'x', on: ['beforeContextCompose'] }]`
- **THEN** 校验通过，装配后该 hook 在组合前触发
