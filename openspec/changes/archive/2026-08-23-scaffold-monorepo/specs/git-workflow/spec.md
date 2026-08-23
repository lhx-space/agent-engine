## ADDED Requirements

### Requirement: 提交前检查

项目 SHALL 通过 husky 的 `pre-commit` hook 触发 lint-staged，对暂存文件自动执行代码检查与格式化。

#### Scenario: 暂存文件自动检查

- **WHEN** 开发者执行 `git commit`
- **THEN** lint-staged 对暂存文件运行 rslint --fix、prettier --write 与 cspell，通过后提交继续

### Requirement: 提交信息校验

项目 SHALL 通过 husky 的 `commit-msg` hook 触发 commitlint，强制 Conventional Commits 格式。

#### Scenario: 非法提交信息被拒绝

- **WHEN** 提交信息不符合 `feat:` / `fix:` / `docs:` 等约定格式
- **THEN** commit-msg hook 拒绝提交并报错

#### Scenario: 合法提交信息放行

- **WHEN** 提交信息为 `feat: scaffold monorepo` 格式
- **THEN** commit-msg hook 放行，提交成功
