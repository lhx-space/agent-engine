## Why

上一版把 `@agent-engine/plugin-files` / `@agent-engine/plugin-bash` 做成了 `core/src/plugins/builtin.ts` 里的「core 内置 plugin 工厂」，与 `packages/plugins/` 下的 `plugin-git` / `plugin-otel` 形态不一致。用户指出 plugin 应统一放在 `packages/plugins/` 独立包，对齐 git。

## What Changes

- 新建独立包 `@agent-engine/plugin-files`、`@agent-engine/plugin-bash`（对齐 `plugin-git` 的包结构）。
- 工具工厂 `createReadFileTool` / `createWriteFileTool` / `createBashTool` 保留在 core 并重新导出，供 plugin 复用。
- 删除 `core/src/plugins/builtin.ts`；`resolveAgentConfig` 移除内置工厂表，统一走 `deps.pluginFactories`。
- server 层新增 `createBuiltinPluginFactories(config)`，注入 files / bash / git 的工厂（带 security / sandbox 上下文），**连带解决 git 的 factory 注入死配置**。

## Capabilities

### Modified Capabilities

- `plugins`: files / bash 从 core 内置改为独立包。
- `agent-resolve`: 移除内置工厂表，统一 `deps.pluginFactories`。
- `server-api`: 内置 plugin 工厂注入。

## Impact

- 新增 `packages/plugins/files/`、`packages/plugins/bash/` 两个包。
- 修改 `packages/core/src/index.ts`（重新导出工具工厂）、`packages/core/src/resolve/resolve.ts`。
- 修改 `packages/server/src/{app,builtin-plugins}.ts`、`packages/server/package.json`。
- 测试迁至各 plugin 包的 `tests/`；core 测试改用内联 plugin 或工具工厂。
- 无运行时破坏（files/bash 仍需 `config.plugins` 声明，但现在由 server 注入 factory）。
