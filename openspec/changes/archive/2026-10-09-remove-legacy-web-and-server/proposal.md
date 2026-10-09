## Why

`add-platform-marketplace` 新建了 `apps/platform`（Next.js 15）作为统一平台宿主，承载市场 UI 与业务 API，并明确了「逐步迁 apps/web 页面、apps/server API 到 apps/platform，agents/ 保留为自托管参考实现」的路线。

当前平台闭环（市场 / 安装 / 实例 / 运行 / 会话历史 / 配置编辑）已在 `apps/platform` 完整跑通，且 `apps/web`（Rsbuild 旧编辑器）与 `apps/server`（Hono HTTP server）的能力已被 `apps/platform` 覆盖。继续保留两个遗留 app 会带来：重复的依赖与构建、两套运行入口、以及维护者认知负担——与「配置即 Agent、单内核」的收敛方向相悖。

## What Changes

- **删除 `apps/web`**：其编辑器能力（三栏配置、流式 chat、测试 agent）已等价实现于 `apps/platform`（`src/components/config/`、`agents/[id]` 聊天页、`agents/[id]/config` 配置页）。
- **删除 `apps/server`**：其 HTTP API（`/api/agent/run`、`/api/agent/run/stream`、skill 发现）的运行能力已由 `apps/platform` 的 `/api/agents/[id]/run` 与 `/api/agents/[id]/run/stream` 复用同一内核覆盖；`SessionStore`/`SessionCache` 退化为平台会话历史（`ConversationStore`）的辅助缓存，不再作为独立 app 存在。
- **清理工作区引用**：`pnpm-lock.yaml` 中 `apps/server`、`apps/web` 条目随删除失效（由 `pnpm install` 重新生成）；`openspec/config.yaml` 的 Web/Dependency 描述改为 `apps/platform`。
- `agents/` 保留为自托管 / 开发模式参考实现（直接扫描 `.lhx-agent/*` 运行），不在本变更范围。

## Capabilities

### Removed Capabilities

- `server-api`: 独立 Hono HTTP server 应用被 `apps/platform` 的 API 路由取代。
- `web-editor`: 独立 Rsbuild Web 编辑器被 `apps/platform` 的配置/聊天页取代。

### Modified Capabilities

- `monorepo-workspace`: 工作区不再包含 `apps/web`、`apps/server`，仅保留 `apps/platform` 作为 Web/API 宿主；依赖方向不再提及 `apps/web` / `server`。

## Impact

- 删除：`apps/web/`、`apps/server/`（含源码、测试、配置、README）。
- 配置：`pnpm-workspace.yaml` 的 `apps/*` glob 自动不再匹配已删目录；`turbo.json` 不受影响。
- 依赖：移除仅 `apps/server` / `apps/web` 使用的依赖（由 `pnpm install` 重算 lockfile 处理）。
- 兼容：运行入口统一为 `apps/platform`（`pnpm --filter @lhx-agent-engine/platform dev`）；旧 `apps/server` 的 Docker/进程启动方式由平台取代。
