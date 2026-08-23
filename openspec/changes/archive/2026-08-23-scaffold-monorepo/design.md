## Context

全新仓库（无既有代码），在进入 M1 内核开发前搭建 pnpm monorepo 工程化基座。技术选型已在 `AGENTS.md` 确定：tsdown（构建）、Rslint（lint）、Prettier（format）、cspell（spell）、Vitest（test）、husky + lint-staged + commitlint（git 工作流）。

## Goals / Non-Goals

**Goals:**

- 统一工具链与根级脚本，全仓一致的构建 / 检查 / 格式化 / 测试入口。
- 建立包结构与单向依赖方向（config ← core ← cli/server ← apps/web）。
- 为后续 M1~M5 的开发提供质量保障与提交规范。

**Non-Goals:**

- 不实现具体业务代码（config 的 Zod Schema、core 的内核 Loop 等留到后续 change）。
- 不引入 LangChain 等重型框架。

## Decisions

1. **构建用 tsdown（rolldown）而非 tsup**：与 Rspress/Rsbuild 同属现代工具链，更快，兼容 tsup 配置。
2. **代码检查用 Rslint（web-infra-dev）而非 ESLint**：Go 引擎、更快，内置 TypeScript-ESLint 规则，ESLint flat config 兼容。
3. **产物采用扁平化 bundle + `exports` 条件导出，而非 antd 式 `es/`+`lib/` 目录**：`exports` 字段 + `.mjs`/`.cjs` 扩展名是当前标准，单入口库无需目录式拆分；tree-shaking 靠 ESM 静态分析 + `sideEffects: false` 标记保证。
4. **类型检查用 `tsc --noEmit`，测试用 Vitest**：职责单一，工具链各司其职。
5. **嵌套插件目录 `packages/plugins/*` 显式加入 workspace**：`packages/*` 不匹配嵌套目录，需在 `pnpm-workspace.yaml` 单独声明。

## Risks / Trade-offs

- [Rslint 处于 0.x 早期，规则覆盖可能不全] → 如遇缺失规则，可回退 ESLint 或待 Rslint 补齐。
- [tsdown 产物为 `.mjs`/`.cjs`，与 `exports` 的 `.js` 假设不一致] → 已统一 exports 指向 `.mjs`/`.cjs` 与 `.d.mts`/`.d.cts`。
- [嵌套包目录易被 workspace/filter 遗漏] → workspace 声明 `packages/plugins/*`，根 build filter 用 `./packages/**` 递归匹配。

## Migration Plan

全新仓库，无迁移与回滚负担。工程化骨架与 OpenSpec 文档一并 commit 固化。
