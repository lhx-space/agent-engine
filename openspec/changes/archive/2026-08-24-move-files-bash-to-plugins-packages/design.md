## Context

`@lhx-agent-engine/plugin-git` 在 `packages/plugins/git/` 是独立包，其工具实现与 plugin 壳同包，工厂 `createGitPlugin({ sandbox })` 由 server 层注入。上一版 files/bash 却做成 `core/src/plugins/builtin.ts` 的 core 内置工厂，形态不一致。本次对齐 git：files/bash 迁到独立包，server 层注入工厂（连带解决 git 的 factory 注入死配置）。

## Goals / Non-Goals

**Goals:**

- files / bash 迁到 `packages/plugins/{files,bash}` 独立包，对齐 git。
- core 保留并导出工具工厂（`createReadFileTool`/`createWriteFileTool`/`createBashTool`）供 plugin 复用。
- resolve 统一走 `deps.pluginFactories`；server 层注入 files/bash/git 工厂。

**Non-Goals:**

- 不迁 `resolveWithinRoot`/`checkBashPolicy`（工具支撑 utils，留在 core）。
- 不做搜索多 provider / web_fetch 修复（那是另一个 change）。
- 不改 `PluginFactory` 签名（仍无参，依赖经闭包捕获 config）。

## Decisions

### D1: 工具工厂留在 core，plugin 壳在独立包

**选择**：`createReadFileTool`/`createWriteFileTool`/`createBashTool` 保留在 `core/src/tools/builtin/` 并由 core 导出；plugin 包的 `install(ctx)` 里 `ctx.registerTool(...)` 复用它们。

**理由**：工具实现依赖 core 的 `resolveWithinRoot`/`checkBashPolicy` utils 与类型，留在 core 避免跨包迁移 utils；plugin 包只做「打包/分发」壳（对齐 5.2 的 plugin 职责）。core 不依赖 plugin 包，依赖方向单向。

### D2: server 层用闭包捕获 config 注入 factory

**选择**：`createBuiltinPluginFactories(config)` 返回 `Record<string, PluginFactory>`，每个 factory 闭包捕获 `config.security`；bash/git 的沙箱在 factory 被调用时惰性解析（`resolveSandboxBackend`）。

**理由**：`PluginFactory` 保持无参（不破坏现有 API），依赖通过闭包注入；惰性解析沙箱避免无关 agent 触发沙箱探测。

### D3: bash 的 enabled 校验放 plugin 壳

**选择**：`createBashPlugin(policy, sandbox)` 的 `install` 里检查 `policy.enabled`，未开启抛错。

**理由**：对齐「bash 未启用不注册」语义；`createBashTool` 内部的 enabled 检查（execute 时）保留为纵深防御。

## Risks / Trade-offs

- [server 依赖 3 个 plugin 包] → 符合依赖方向（server ← plugins），是装配层的职责。
- [git 的沙箱策略仍无独立配置] → 沿用 `security.sandbox` 解析，git 的 allow/deny 由 plugin 默认策略控制，后续可扩展。

## Migration Plan

无破坏。files/bash 仍需 `config.plugins` 声明；差异在于工厂改由 server 注入，`plugin-git` 现在也能真正通过 `config.plugins` 加载（此前是死配置）。
