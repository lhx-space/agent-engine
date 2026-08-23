## 1. Turborepo

- [x] 1.1 安装 `turbo`，新建 `turbo.json`（build 缓存 dist/** + typecheck）
- [x] 1.2 各包补 `typecheck` script（tsc --noEmit）
- [x] 1.3 root `build` / `typecheck` 改 `turbo run`

## 2. Rstest 迁移

- [x] 2.1 安装 `@rstest/core`，删除 `vitest`
- [x] 2.2 `vitest.config.ts` → `rstest.config.ts`
- [x] 2.3 迁移 13 个测试文件 import（vitest → @rstest/core，vi → rs）
- [x] 2.4 `test` / `test:watch` 脚本改 `rstest`

## 3. 验证

- [x] 3.1 `pnpm test` 全绿
- [x] 3.2 `pnpm build` / `pnpm typecheck` 走 turbo 通过
- [x] 3.3 lint / format / spell 通过
