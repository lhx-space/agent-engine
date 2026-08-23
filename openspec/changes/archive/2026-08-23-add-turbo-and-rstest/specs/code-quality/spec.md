## ADDED Requirements

### Requirement: Rstest 测试框架

系统 SHALL 使用 Rstest（`@rstest/core`）作为测试框架，配置为 `rstest.config.ts`；测试文件 SHALL 从 `@rstest/core` 导入 `describe` / `it` / `expect` 等 API，mock 工具 SHALL 使用 `rs.*`（`rs.fn` / `rs.mock` / `rs.hoisted` 等）。

#### Scenario: 测试 API 迁移

- **WHEN** 测试文件使用 `describe` / `it` / `expect` 与 `rs.fn` 等
- **THEN** 测试行为与迁移前等价，`pnpm test`（`rstest`）通过

#### Scenario: mock 兼容

- **WHEN** 测试用 `rs.mock` 模拟第三方 SDK 模块
- **THEN** 模块 mock 生效，provider 单测通过
