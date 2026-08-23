## 1. 工程化基座

- [x] 1.1 git init + 根级基础文件（package.json / pnpm-workspace.yaml / .npmrc / .nvmrc / .editorconfig / .gitignore / .gitattributes）
- [x] 1.2 共享 TypeScript 配置（tsconfig.base.json + 各包 tsconfig.json）
- [x] 1.3 代码检查与格式化（rslint.config.ts / .prettierrc / cspell.json）
- [x] 1.4 git hooks（husky pre-commit + commit-msg / lint-staged / commitlint）
- [x] 1.5 测试与 IDE 配置（vitest.config.ts / .vscode）

## 2. 包骨架

- [x] 2.1 packages/config、core、cli、server、plugins/otel 包骨架
- [x] 2.2 apps/web（React 19 + Rsbuild）骨架
- [x] 2.3 docs（Rspress）骨架
- [x] 2.4 各包 tsdown.config.ts + 双格式 exports + sideEffects:false

## 3. 验证

- [x] 3.1 pnpm install 成功（含 husky prepare）
- [x] 3.2 pnpm build（5 包）+ lint + typecheck + format:check + spell 全通过
