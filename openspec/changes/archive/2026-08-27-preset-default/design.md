## Context

能力外放后，装配责任落到组合层。`preset-default` 是组合层的「默认全家桶」：闭包 `config` 切片为每个能力插件提供工厂，并按切片激活（D1-A 零迁移）。core 只提供装配协议（`defaultPlugins` / `longTermMemoryFactory`），不硬编码能力映射。

## Goals / Non-Goals

**Goals:**

- `preset-default` 聚合全部能力插件工厂 + 能力激活 + 长期记忆工厂。
- core 新增 `defaultPlugins` / `longTermMemoryFactory` 装配协议。
- server 改用 preset。

**Non-Goals:**

- 不改 config schema（D1-A 字段保留）。
- 不改各能力插件的内部实现。

## Decisions

### D1: `defaultPlugins` 承载「config 切片 → 能力插件」映射

**选择**：core `ResolveDeps.defaultPlugins?: string[]`，与 `config.plugins` 去重合并后按名实例化；`preset-default` 的 `defaultCapabilityPlugins(config)` 计算该列表（rules/skills/documents/guardrails/mcp 按切片非空激活，web 恒激活）。

**理由**：映射逻辑留在组合层（preset），core 只「按名实例化」，保持能力无关。files/bash/git 仍经 `config.plugins` 显式声明（安全工具需用户显式启用）。

### D2: `longTermMemoryFactory` 解决语义记忆时序

**选择**：core `ResolveDeps.longTermMemoryFactory?: (deps) => LongTermMemory`，`assemble` 用解析出的 vectorStore/embedding/memoryBackend 调工厂（缺省 no-op）；`preset-default` 提供 `createPresetLongTermMemoryFactory()`（`plugin-memory` 的 `SemanticMemory`）。

**理由**：`SemanticMemory` 依赖 assemble 内解析的后端，无法在 plugin `install` 期创建；工厂 + 注入在 resolve/assemble 时序内正确创建。

### D3: server 用 preset 替代 `builtin-plugins.ts`

**选择**：删除 server 的 `builtin-plugins.ts`，改用 `createPresetPluginFactories` / `defaultCapabilityPlugins` / `createPresetLongTermMemoryFactory`。

**理由**：消除 server 与 preset 的重复工厂逻辑；`options.pluginFactories`（用户自定义插件）仍与 preset 工厂合并。

## Risks / Trade-offs

- [web 恒激活] `defaultCapabilityPlugins` 恒含 `plugin-web`（web_search/web_fetch 是通用工具）；若用户不想要 web 工具，需显式 `tools.disabled` 或自定义 preset。
- [语义记忆默认恢复] server 装配时注入 `longTermMemoryFactory`，无 embedding 时 `SemanticMemory` 仍 no-op（行为与旧一致）。
