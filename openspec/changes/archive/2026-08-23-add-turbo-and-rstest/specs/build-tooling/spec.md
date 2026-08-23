## ADDED Requirements

### Requirement: Turborepo 构建缓存

系统 SHALL 使用 Turborepo 编排 per-package 的 `build` 与 `typecheck`：`turbo.json` 声明 `build` 缓存 `dist/**`、依赖 `^build`；`typecheck` 依赖 `^build`。root `build` / `typecheck` 脚本 SHALL 走 `turbo run`。

#### Scenario: 构建缓存

- **WHEN** 执行 `pnpm build` 后再次执行（无变更）
- **THEN** 各包命中本地缓存，跳过重复构建

#### Scenario: 依赖图编排

- **WHEN** 某包依赖的包重新构建
- **THEN** 依赖包的 `build` 先于其消费者执行（`^build`）
