## Why

两项工程化优化：

1. **构建缓存**：monorepo 当前 `build` 用 `pnpm -r` 全量重建，无增量缓存。引入 Turborepo 为 per-package 的 `build` / `typecheck` 提供依赖图编排 + 本地缓存（仅重建变更的包）。
2. **测试框架统一**：测试用 Vitest，但代码检查 / 文档 / Web 已走 web-infra-dev 生态（Rslint / Rspress / Rsbuild）。迁移到 Rstest（`@rstest/core`）与生态统一，API 兼容 Vitest（仅 `vi.* → rs.*`）。

## What Changes

- **引入 Turborepo**：`turbo` devDependency + `turbo.json`（`build` 缓存 `dist/**`、`typecheck` 编排）；各包补 `typecheck` script；root `build` / `typecheck` 改 `turbo run`。
- **迁移 Rstest**：`@rstest/core` 替换 `vitest`；`vitest.config.ts` → `rstest.config.ts`；13 个测试文件 `import from 'vitest'` → `@rstest/core`，`vi.*` → `rs.*`；`test` 脚本改 `rstest`。

## Capabilities

### Modified Capabilities

- `build-tooling`: 新增 Turborepo 构建缓存。
- `code-quality`: 测试框架 Vitest → Rstest。

## Impact

- 修改根 `package.json`（scripts + devDependencies）、新增 `turbo.json`、`rstest.config.ts`；删除 `vitest.config.ts`。
- 修改 `packages/*/package.json`（补 `typecheck` script）。
- 修改 13 个测试文件的 import（`vitest` → `@rstest/core`，`vi` → `rs`）。
- 无业务代码变更；测试行为不变。
