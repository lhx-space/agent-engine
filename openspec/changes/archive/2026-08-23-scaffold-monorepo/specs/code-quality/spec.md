## ADDED Requirements

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
