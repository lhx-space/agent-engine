## Context

事实：

1. `apps/platform` 已实现市场、安装、实例、运行、会话历史、配置编辑完整闭环（见 `add-platform-marketplace`）。
2. `apps/web`（Rsbuild）只提供编辑器 UI；`apps/server`（Hono）只提供运行 API。两者能力均被 `apps/platform` 覆盖。
3. `apps/web` / `apps/server` 在 `add-platform-marketplace` 阶段被显式「短期并存」，现迁移已完成，可删除。

## Goals / Non-Goals

**Goals:** 删除两个遗留 app，统一到 `apps/platform`，降低维护面。

**Non-Goals:** 不改动内核、插件、`agents/`（自托管参考实现保留）。

## Decisions

### 决策 1：整体删除而非保留兼容层

两个 app 功能已被完全覆盖，保留空壳只增加维护成本；直接删除，依赖由 `pnpm install` 重算。

### 决策 2：`server-api` / `web-editor` 能力从 spec 移除

删除这两个独立 capability 的 spec 需求，其功能归属于 `apps/platform` 的既有描述（不在独立 spec 中单列）。

### 决策 3：依赖方向描述同步收敛

`monorepo-workspace` 的「单向依赖方向」需求原指向 `apps/web` / `server`，改为指向 `apps/platform`。

## Risks / Trade-offs

- **[运行入口变更]** 原先 `apps/server` 的启动方式不再可用 → 统一改用 `apps/platform`；在 README 中说明。
- **[依赖遗漏]** 删除后可能有仅该 app 引用的依赖残留于根 lockfile → 跑 `pnpm install` 重算，并用 `pnpm typecheck` / `pnpm build` 回归。

## Migration Plan

1. 删除 `apps/web`、`apps/server` 目录。
2. `pnpm install` 重算 lockfile。
3. `pnpm typecheck` / `pnpm build`（packages）与 `apps/platform` build 回归。
4. 更新 `openspec/config.yaml` 与 README 引用。

## Open Questions

- 无。
