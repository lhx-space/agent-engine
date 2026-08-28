## Why

M2「配置化能力」的最后一块缺口：**内置工具**。当前 `ToolRegistry` 机制齐备但为空，Agent 没有任何开箱即用的能力，demo 全靠 mock 工具。补上 `read_file` / `write_file` / `bash` / `web_search` / `todo` 五个内置工具，配合已有的 system-prompt / rules / skills / plugins / memory，「配置即 Agent」第一次真正能跑起来。

其中 `todo` 让 Agent 在现有 ReAct 循环内自然涌现「列计划 → 执行」的任务规划（AGENTS.md 6.2：Task Planner 是「工具 + prompt 涌现」，**内核零改动**）。

## What Changes

- 新增 `packages/core/src/tools/builtin/`：`todo` / `read_file` / `write_file` / `bash` / `web_search` 五个内置工具。
- 策略执行：`bash` 白/黑名单 + 网络开关（走 `execution-sandbox` 的 `SandboxBackend`）；`read_file` / `write_file` 路径约束（workspaceRoot + `realpath` 防 symlink 逃逸）；`web_search` domain 白/黑名单。
- 统一装配入口 `registerBuiltinTools(registry, security, deps)`：todo/read_file/write_file/web_search 恒注册，`bash` 仅 `security.bash.enabled` 时注册（无沙箱则报错/跳过）。

## Capabilities

### New Capabilities

- `builtin-tools`: `todo` / `read_file` / `write_file` / `bash` / `web_search` 内置工具 + 策略执行 + 统一装配。

### Modified Capabilities

<!-- 无：复用 tool-registry 的 Tool 接口与 execution-sandbox 的 SandboxBackend，二者 requirement 不变 -->

## Impact

- 新增 `packages/core/src/tools/builtin/`（todo.ts / file.ts / bash.ts / web-search.ts / index.ts）。
- 消费 `packages/core/src/tools/types.ts`（`Tool`）、`packages/core/src/tools/registry.ts`（`ToolRegistry`）、`packages/core/src/sandbox/`（`SandboxBackend`，前一 change）。
- 消费 `@lhx-agent-engine/config` 的 `SecurityConfig` 类型。
- **无新增三方依赖**：`node:fs` / `node:child_process` / 全局 `fetch`。
- 新增 `packages/core/tests/builtin-tools.test.ts`（todo 状态流转 / 文件路径约束含 symlink / bash 策略 / web_search domain 策略，用假 fetch 与假沙箱）。
- 无 breaking changes（纯新增工具；demo 可从 mock 升级为真实内置工具）。
