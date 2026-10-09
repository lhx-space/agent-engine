## 1. 删除遗留应用

- [x] 1.1 删除 `apps/web/`（Rsbuild 旧编辑器）
- [x] 1.2 删除 `apps/server/`（Hono HTTP server，含 SessionCache 旧实现）

## 2. 工作区与依赖清理

- [x] 2.1 `pnpm install` 重算 `pnpm-lock.yaml`，移除失效的 `apps/server` / `apps/web` 条目
- [x] 2.2 `pnpm typecheck` / `pnpm build`（packages）与 `apps/platform` build 回归通过

## 3. 文档与配置

- [x] 3.1 更新 `openspec/config.yaml`：Web / Dependency direction 改为 `apps/platform`
- [x] 3.2 更新 `AGENTS.md` 引用（apps/web 组件迁入 apps/platform）
