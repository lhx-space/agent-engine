## Context

内置工具「恒全注册」把 code agent 专属的 file/bash 与鸡肋工具（json/base64/calculator/sitesearch）塞进通用内核，违背「内核与能力解耦」。对标 Claude Code（file/bash 是 code agent 场景工具）与「配置即 Agent」：内核只内置通用原语，垂直能力按 `config.plugins` 声明加载。`@agent-engine/plugin-git` 已开先例（git 是 plugin 不是内置）。

## Goals / Non-Goals

**Goals:**

- 内置收敛为 `todo` / `datetime` / `web_search` / `web_fetch` 四个通用原语。
- `read_file` / `write_file` → 内置 plugin `@agent-engine/plugin-files`。
- `bash` → 内置 plugin `@agent-engine/plugin-bash`。
- 移除 `json` / `base64` / `calculator` / `sitesearch`。
- resolve 按 `config.plugins` 加载内置 plugin（带 security/sandbox 上下文）。

**Non-Goals:**

- 不做 `list_files`/`glob`（那是 plugin-files 的后续增强，P1）。
- 不改 `tools` 配置语义（额外工具引用仍死配置，后续单独 change）。
- 不做搜索后端多 provider（SearXNG 等，那是另一个 change）。

## Decisions

### D1: file/bash 做成「core 内置 plugin」，不建独立 npm 包

**选择**：`core/src/plugins/builtin.ts` 提供 `createFilesPlugin` / `createBashPlugin` 工厂；resolve 内置一张「内置 plugin 工厂表」，按 `config.plugins` 里的名字命中时用 core 内部工厂（带 security/sandbox）构造，未命中再查 `deps.pluginFactories`。

**理由**：file/bash 的工厂需要 `security` 策略与 `sandbox` 后端，这些在 core 内部才有；建独立 npm 包会导致「工厂拿不到 security/sandbox」的注入问题。内置 plugin 与外部 plugin（git）同走 `config.plugins`，语义统一。

### D2: 工具工厂代码保留在 `tools/builtin/`，plugin 只做注册

**选择**：`createReadFileTool`/`createWriteFileTool`/`createBashTool` 仍留在 `tools/builtin/{file,bash}.ts`；新 plugin 的 `install(ctx)` 里 `ctx.registerTool(...)` 复用它们。

**理由**：工具实现不变，只改「注册路径」；plugin 是「打包/分发」壳，不承载工具逻辑。

### D3: bash 的 sandbox 解析移到 plugin 工厂内

**选择**：`createBashPlugin({ policy, sandbox, sandboxConfig })` 在 install 时若 `sandbox` 未提供，则 `resolveSandboxBackend(sandboxConfig.backend, ...)`，不可用则抛错。

**理由**：复用原 `registerBuiltinTools` 的「沙箱不可用即禁用、绝不裸奔」语义。

### D4: 鸡肋工具直接移除，不做「按需」开关

**选择**：`json`/`base64`/`calculator`/`sitesearch` 从内置删除，不保留「可配置启用」。

**理由**：LLM 自己就能做（json/base64/简单算术）、或无效冗余（sitesearch）；保留开关徒增复杂度。确有需要时由 plugin/skill 提供。

## Risks / Trade-offs

- [Breaking：file/bash 默认不注册] → 现有依赖 file/bash 的配置/测试需显式声明 plugin；文档与前端预设同步。
- [内置 plugin 名与外部 plugin 名冲突] → 内置表优先，外部同名被遮蔽；名字用 `@agent-engine/` 前缀避免冲突。

## Migration Plan

- 配置里需要 file/bash 的 agent，改为 `plugins: ['@agent-engine/plugin-files', '@agent-engine/plugin-bash']`。
- 前端 plugins 面板补这两个预设。
- 测试：builtin-tools 断言改为「内置 4 个 + plugin 按声明加载」；demo.test 改用 plugin-files。
