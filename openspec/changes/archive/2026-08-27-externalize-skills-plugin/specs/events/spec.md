## MODIFIED Requirements

### Requirement: EventBus 发布订阅

系统 SHALL 提供 `EventBus`：`on(listener)` 注册监听器并返回取消函数、`emit(event)` 同步通知全部监听器；事件类型为 `AgentEngineEvent` 判别联合（`plugin.installed` / `mcp.connected` / `mcp.failed` / `tool.registered` / `custom`）。装配层 SHALL 在装插件、连 mcp、注册工具时发对应事件，并把 `EventBus` 随 `ResolvedAgent.eventBus` 暴露。

#### Scenario: 订阅与取消

- **WHEN** 以 `on` 注册监听器后 `emit` 某事件
- **THEN** 监听器收到该事件；调用取消函数后不再收到

#### Scenario: 装配期发事件

- **WHEN** 装配一个含 plugin 与 mcp 的 Agent
- **THEN** 总线发出 `plugin.installed`、`tool.registered`、`mcp.connected`（或失败时 `mcp.failed`）事件

#### Scenario: custom 逃生舱

- **WHEN** 经 `emit({ type:'custom', name, data })` 发自定义事件
- **THEN** 监听器收到该事件（`data` 原样透传）
