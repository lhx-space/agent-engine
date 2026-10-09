## MODIFIED Requirements

### Requirement: Plugin 与 PluginContext

`PluginContext` SHALL 额外提供 `registerConversationStore(store)` 注册出口，用于插件注入对话历史后端；注册契约与 `registerMemoryBackend` / `registerCacheBackend` / `registerVectorStore` 一致（按 `name` 索引，后注册覆盖同名）。

#### Scenario: 插件注入对话后端

- **WHEN** 插件在 `install` 中调用 `ctx.registerConversationStore({ name: 'pg', ... })`
- **THEN** 该实现进入能力束，可被 `session.store: pg` 选中

### Requirement: PluginManager 收集

`CapabilityBundle` SHALL 增加 `conversationStores` 字段，`mergeBundles` SHALL 以与其余后端相同的规则汇聚（按注册顺序，同名后者覆盖）。

#### Scenario: 多插件注册同名后端

- **WHEN** 两个插件注册同名 `conversationStore`
- **THEN** 后注册者生效，行为与其余后端一致
