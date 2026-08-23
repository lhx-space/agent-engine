## Context

`config` 包是依赖方向的根（config ← core ← cli/server），当前为占位实现（仅导出 name/version）。本次引入 `AgentConfig` 的 Zod Schema 与三格式 loader，为后续 core 提供类型契约。

## Goals / Non-Goals

**Goals:**

- 用 Zod 4 定义 `AgentConfig`，`z.infer` 衍生 TS 类型（单一事实来源）。
- 三格式 loader 归一化为同一份 `AgentConfig`，校验失败抛出可读错误。

**Non-Goals:**

- 不实现配置引用解析（`${VAR}` 环境变量展开、`extends` 继承等，留待后续 change）。
- 不实现热更新与 watch。

## Decisions

1. **Zod 4 API**：使用 `z.object` + `z.infer`；注意 v4 与 v3 的差异（错误消息、部分方法签名），以 TS 类型检查为准。
2. **按扩展名选解析器**：`.yaml`/`.yml` → `yaml`；`.json`/`.json5` → `json5`（JSON 也走 json5，向后兼容注释）；`.ts`/`.mts` → `jiti`。
3. **统一入口**：`loadAgentConfig(path): Promise<AgentConfig>`，内部解析后走 `AgentConfigSchema.parse()` 校验。
4. **jiti 加载 TS**：`createJiti(import.meta.url)` 动态 import 配置模块，取 `default` 导出。

## Risks / Trade-offs

- [Zod 4 API 与 v3 差异] → spec 固定 v4 用法，apply 阶段以 `pnpm typecheck` 为准。
- [jiti 的 ESM/TS 兼容] → jiti ^2.7 支持 ESM，加载失败时抛包含文件路径的错误。
- [JSON5 解析 JSON 的宽松性] → 可接受，JSON 带注释是本项目的既有诉求。

## Migration Plan

无迁移。config 包当前为占位实现，直接替换为 Schema + loader 并补充导出。
