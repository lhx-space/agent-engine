## ADDED Requirements

### Requirement: onInit 触发

`resolveAgentConfig` SHALL 在装配完成、返回 `ResolvedAgent` 前触发 `onInit`（若注册了该 hook）；`onInit` 抛错 SHALL 使 resolve 失败并抛出（同其他装配错误）。

#### Scenario: 装配完成触发 onInit

- **WHEN** 注入含 `onInit` 的 hook 并调用 `resolveAgentConfig`
- **THEN** 装配完成后 `onInit` 触发一次

#### Scenario: onInit 抛错使 resolve 失败

- **WHEN** `onInit` 抛错
- **THEN** `resolveAgentConfig` 抛出该错误，返回前释放已装配资源

#### Scenario: 未注册 onInit 不报错

- **WHEN** 未注入含 `onInit` 的 hook
- **THEN** resolve 正常完成，无副作用
