## Why

能力全部外放后，用户需逐个装配 `plugin-rules` / `plugin-skills` / `plugin-documents` / `plugin-memory` / `plugin-web` / `plugin-mcp` 才能还原今天的能力。本 change 提供 `@agent-engine/preset-default` 全家桶，聚合全部能力插件 + 安全工具，一行配置还原能力（D5）。

## What Changes

- **新增 `@agent-engine/preset-default`**：`createPresetPluginFactories(config)`（聚合 files/bash/git/rules/skills/documents/guardrails/web/mcp 工厂）、`defaultCapabilityPlugins(config)`（按 config 切片激活能力插件）、`createPresetLongTermMemoryFactory()`（SemanticMemory 工厂）。
- **core 装配协议**：`ResolveDeps.defaultPlugins`（组合层按 config 切片激活的额外插件，与 `config.plugins` 去重合并）、`ResolveDeps.longTermMemoryFactory`（用装配层后端创建 `LongTermMemory`）。
- **server 改用 preset**：删除 `builtin-plugins.ts`，改用 `@agent-engine/preset-default` 装配。

## Capabilities

### New Capabilities

- `preset-default`: `@agent-engine/preset-default` 聚合全部能力插件工厂 + 能力激活 + 长期记忆工厂。

### Modified Capabilities

- `agent-resolve`: `ResolveDeps` 新增 `defaultPlugins` 与 `longTermMemoryFactory`。

## Impact

- 新增 `packages/plugins/preset-default/`（package.json / tsconfig / tsdown / src / tests / README）。
- 修改 `packages/core/src/resolve/{resolve.ts,types.ts}`、`agent/assemble.ts`、`index.ts`。
- 修改 `packages/server/{app.ts,package.json}`（删 builtin-plugins.ts）。
- 兼容性：`config` 字段不变；`config.plugins` 显式声明 files/bash/git 仍生效。
