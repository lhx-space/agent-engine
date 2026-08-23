## Why

Agent Engine 是一个多包的 pnpm monorepo（packages / apps / docs），在进入 M1 内核开发前，需要一套统一的工程化基座——构建、代码检查、格式化、拼写检查、git 提交规范与类型检查。缺少这套基座，后续各包开发将缺乏一致的工具链与质量保障。

## What Changes

- 搭建 pnpm workspace monorepo：`packages/*`、`packages/plugins/*`、`apps/*`、`docs`。
- 引入 **tsdown** 作为库构建工具（ESM + CJS 双产物 + d.ts，`sideEffects: false` 标记）。
- 引入 **Rslint**（代码检查）+ **Prettier**（格式化）+ **cspell**（拼写检查）。
- 引入 **husky + lint-staged + commitlint**（提交前检查 + Conventional Commits 校验）。
- 引入 **Vitest**（测试）与 **tsc --noEmit**（类型检查）。
- 建立 `packages/config`、`core`、`cli`、`server`、`plugins/otel` 与 `apps/web`、`docs` 的包骨架。
- 统一 TypeScript 配置（`tsconfig.base.json` + 各包 `tsconfig.json`）。

## Capabilities

### New Capabilities

- `monorepo-workspace`: pnpm workspace 与包结构、单向依赖方向（config ← core ← cli/server ← apps/web）。
- `build-tooling`: tsdown 库构建（ESM/CJS 双产物、d.ts 生成、`sideEffects: false`）。
- `code-quality`: Rslint + Prettier + cspell 代码质量工具链。
- `git-workflow`: husky + lint-staged + commitlint 提交前检查与提交信息校验。

### Modified Capabilities

<!-- 全新仓库，无既有能力被修改 -->

## Impact

- 新增根级工程化配置：`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`rslint.config.ts`、`.prettierrc`、`cspell.json`、`commitlint.config.mjs`、`lint-staged.config.mjs`、`vitest.config.ts`、`.husky/`、`.npmrc`、`.nvmrc`、`.editorconfig`、`.gitattributes`、`.vscode/`。
- 新增 5 个 `packages/*` 包骨架 + `apps/web` + `docs`。
- 无 breaking changes（全新仓库，无既有代码）。
