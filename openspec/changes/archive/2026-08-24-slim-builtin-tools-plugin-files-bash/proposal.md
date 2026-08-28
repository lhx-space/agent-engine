## Why

当前 11 个内置工具**恒全注册**，但其中混入了「垂直场景专属」能力（`read_file`/`write_file`/`bash` 是 code agent / 命令执行场景才需要的）和「LLM 自己能做」的鸡肋（`json`/`base64`/`calculator`）。这违背「内核与能力解耦」「配置即 Agent」——通用 harness 不该预设自己是 code agent，且工具越多越稀释上下文、越容易选错。

## What Changes

- 内置工具收敛为**四个通用原语**：`todo` / `datetime` / `web_search` / `web_fetch`。
- `read_file` / `write_file` 迁出内置，做成内置 plugin `@lhx-agent-engine/plugin-files`（经 `config.plugins` 声明加载）。
- `bash` 迁出内置，做成内置 plugin `@lhx-agent-engine/plugin-bash`（经 `config.plugins` 声明加载）。
- 移除鸡肋工具 `json` / `base64` / `calculator` / `sitesearch`。
- `resolveAgentConfig` 支持「内置 plugin 工厂」（带 security/sandbox 上下文），与外部 `deps.pluginFactories` 并列。

## Capabilities

### Modified Capabilities

- `builtin-tools`: 内置工具集收敛 + file/bash 迁出。
- `plugins`: 新增内置 plugin `@lhx-agent-engine/plugin-files` / `@lhx-agent-engine/plugin-bash`。
- `agent-resolve`: 按 `config.plugins` 加载内置 plugin。
- `web-editor`: plugins 面板增加内置 plugin 预设。

## Impact

- 修改 `packages/core/src/tools/builtin/index.ts`、`packages/core/src/plugins/`、`packages/core/src/resolve/resolve.ts`、`packages/core/src/index.ts`。
- 修改 `apps/web/src/config/PluginsForm.tsx`。
- 大改 `builtin-tools.test.ts`、`demo.test.ts` 等测试。
- **Breaking**：`read_file`/`write_file`/`bash` 不再默认注册，需在 `config.plugins` 声明 `@lhx-agent-engine/plugin-files` / `@lhx-agent-engine/plugin-bash`；`json`/`base64`/`calculator`/`sitesearch` 移除。
