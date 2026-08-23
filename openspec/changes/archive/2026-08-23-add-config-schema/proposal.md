## Why

Agent 内核执行引擎需要一份「单一事实来源」的配置类型契约——把 plugins / mcp / skills / tools / system-prompt / memory / rules / hooks 八大配置项统一为 `AgentConfig`。这是后续 `core`（LLM Provider、Tool 注册表、Agent Loop）、`server`、`apps/web` 表单共同依赖的地基。同时，配置需支持 YAML / JSON / TypeScript 三种格式，加载后归一化为同一份 `AgentConfig`。

## What Changes

- 新增 `AgentConfig` 的 Zod Schema，覆盖 model、systemPrompt、rules、tools、mcp、skills、memory、hooks、plugins、orchestration。
- 新增三格式 loader `loadAgentConfig(path)`，支持 YAML / JSON5 / TypeScript。
- 新增契约测试：三种格式产出等价的 `AgentConfig`。

## Capabilities

### New Capabilities

- `agent-config-schema`: `AgentConfig` 及其子 schema 的 Zod 定义，`z.infer` 衍生 TS 类型。
- `config-loading`: YAML / JSON5 / TypeScript 三种格式的加载与归一化。

### Modified Capabilities

<!-- 无 -->

## Impact

- 新增 `packages/config/src/schema/`（Zod Schema）与 `packages/config/src/loader/`（三格式加载）。
- 依赖：`zod ^4.4.3`、`yaml ^2.9.0`、`json5 ^2.2.3`、`jiti ^2.7.0`（均已声明），`@types/node`（根 devDependency，已补充）。
- 无 breaking changes（config 包当前为占位实现）。
