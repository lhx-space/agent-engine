## ADDED Requirements

### Requirement: hook trace 监听

`HookPipeline` SHALL 提供 `onTrace(listener)`；每当一个 hook 在一个钩子点执行时，产出 `HookTrace`（`hook` 名 / `point` 钩子点 / `durationMs` 耗时 / `changed` 是否改写入参）。

#### Scenario: hook 执行产出 trace

- **WHEN** 一个 hook 在 `beforeLLM` 点执行
- **THEN** listener 收到 `{ hook, point: 'beforeLLM', durationMs, changed }`

#### Scenario: 改写标记

- **WHEN** hook 返回了与入参不同的值
- **THEN** trace 的 `changed` 为 true；返回 void 时为 false

#### Scenario: 无 listener 不报错

- **WHEN** 未调用 `onTrace`
- **THEN** hook 正常执行，无副作用
