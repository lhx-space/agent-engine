# code-quality Specification

## Purpose

TBD - created by archiving change scaffold-monorepo. Update Purpose after archive.

## Requirements

### Requirement: Rslint 代码检查

项目 SHALL 使用 Rslint 进行代码检查，配置文件为 `rslint.config.ts`，兼容 ESLint flat config 与 TypeScript-ESLint 规则。

#### Scenario: 全仓 lint 通过

- **WHEN** 执行 `pnpm lint`（`rslint .`）
- **THEN** 全仓代码通过检查，无 error 与 warning

### Requirement: Prettier 格式化

项目 SHALL 使用 Prettier 统一代码风格，配置文件为 `.prettierrc`，忽略列表为 `.prettierignore`（含 `.codebuddy` 等生成目录）。

#### Scenario: 格式校验

- **WHEN** 执行 `pnpm format:check`
- **THEN** 所有纳入检查的文件符合 Prettier 风格

### Requirement: cspell 拼写检查

项目 SHALL 使用 cspell 校验拼写，配置文件为 `cspell.json`，领域术语（如 tsdown、rspress、pgvector、deepseek）SHALL 收录于 `words`。

#### Scenario: 拼写无未知词

- **WHEN** 执行 `pnpm spell`
- **THEN** 全仓无 Unknown word，领域术语不误报

### Requirement: Rstest 测试框架

系统 SHALL 使用 Rstest（`@rstest/core`）作为测试框架，配置为 `rstest.config.ts`；测试文件 SHALL 从 `@rstest/core` 导入 `describe` / `it` / `expect` 等 API，mock 工具 SHALL 使用 `rs.*`（`rs.fn` / `rs.mock` / `rs.hoisted` 等）。

#### Scenario: 测试 API 迁移

- **WHEN** 测试文件使用 `describe` / `it` / `expect` 与 `rs.fn` 等
- **THEN** 测试行为与迁移前等价，`pnpm test`（`rstest`）通过

#### Scenario: mock 兼容

- **WHEN** 测试用 `rs.mock` 模拟第三方 SDK 模块
- **THEN** 模块 mock 生效，provider 单测通过
