## Context

monorepo 的 `build` 是 `pnpm -r` 全量重建；测试用 Vitest，与 web-infra-dev 生态（Rslint/Rsbuild/Rspress）不统一。引入 Turborepo 缓存构建，迁移 Rstest 统一测试。

## Goals / Non-Goals

**Goals:**

- Turborepo 编排 `build`（缓存 `dist/**`）与 `typecheck`。
- Rstest 替换 Vitest，测试 API 迁移（`vi.* → rs.*`），行为不变。

**Non-Goals:**

- 不引入远程缓存（`turbo login` / 远程 cache），仅本地缓存。
- 不做 Rstest 多 project / 快照 / coverage（当前无此需求）。
- 不改测试断言逻辑（仅迁移框架）。

## Decisions

### D1: turbo 只编排 build / typecheck，其余命令保持 root 级

**选择**：`turbo run build`（缓存）+ `turbo run typecheck`（编排）；`test` / `lint` / `format` / `spell` 保持 root 级单命令。

**理由**：turbo 价值在于 per-package 依赖图 + 缓存；`lint`（`rslint .`）/ `format` / `spell` 是全仓单命令、无 per-package 缓存点，`test` 当前是 root 级单 config。只 turbo 化真正有缓存的 `build` 与 per-package 的 `typecheck`，避免过度改造。

### D2: Rstest 用 root 级单 config，对齐 Vitest 现状

**选择**：`rstest.config.ts`（root），`include` 指向 `packages/**/tests/**`，与现有 `vitest.config.ts` 一致。

**理由**：测试是「全仓一次跑」的现状，不引入多 project 复杂度；后续需要按包缓存测试时再迁 `turbo run test`。

### D3: vi → rs 的 API 映射

**选择**：`vi.fn` → `rs.fn`、`vi.mock` → `rs.mock`、`vi.hoisted` → `rs.hoisted`、`vi.clearAllMocks` → `rs.clearAllMocks`、`vi.spyOn` → `rs.spyOn`；`describe` / `it` / `expect` / `beforeEach` / `afterEach` 原样（Rstest 兼容）。

**理由**：依据 [Rstest Vitest 迁移指南](https://rstest.rs/zh/guide/migration/vitest) 的官方映射；`rs` 与 `rstest` 是等价别名，统一用 `rs` 保持风格一致。

## Risks / Trade-offs

- [`vi.hoisted` / `vi.mock` 兼容性] → `llm.test.ts` 用模块 mock，是迁移唯一风险点；若 `rs.hoisted` 行为有差异，改为 `rs.mock` 内联工厂函数。
- [turbo 首次引入] → `build` 从 `pnpm -r` 切到 `turbo run build`，需确认各包 `build` script 名称一致（均为 `build`）。
- [Rstest 年轻] → 0.5.x，若遇兼容性问题可回退 vitest（迁移可逆，仅 import + config）。

## Migration Plan

1. 装 `turbo` + `@rstest/core`，删 `vitest`。
2. 建 `turbo.json`、`rstest.config.ts`；各包补 `typecheck`。
3. 批量迁移测试 import（`vitest` → `@rstest/core`，`vi` → `rs`）。
4. 跑 `pnpm test` / `pnpm build` / `pnpm typecheck` 验证。
