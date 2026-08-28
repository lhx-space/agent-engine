## Why

Agent Loop（ReAct 循环）需要「执行工具」的能力：模型返回工具调用后，内核要把调用派发给对应的工具实现，并把结果回填上下文。当前 `core` 包已有 LLM Provider（上一 change），但还没有「工具」这一层——没有统一的 Tool 接口与注册表，Agent Loop 就无法落地。

同时，工具层是「能力层」的根基（AGENTS.md 5.1 节）：后续 `plugins`、`skills`、`mcp` 接入的工具最终都要注册进同一个 Tool Registry，所以这一层必须先行，并且接口要足够通用。

## What Changes

- 定义 `Tool` 接口：`name` / `description` / `inputSchema`（Zod）/ `execute`。
- 定义 `ToolRegistry`：`register` / `get` / `has` / `list` / `execute`（含参数校验）/ `toToolDefinitions`。
- 实现 **Zod → JSON Schema** 转换（使用 Zod 4 内置的 `toJSONSchema`），把工具的 `inputSchema` 转成 LLM 需要的 `ToolDefinition`。
- 工具执行的完整链路：JSON 字符串参数 → `JSON.parse` → `inputSchema.parse` 校验 → `execute` → 结果。

## Capabilities

### New Capabilities

- `tool-registry`: `Tool` 接口、`ToolRegistry` 注册表、Zod → JSON Schema 转换、工具执行（含参数校验）。

### Modified Capabilities

<!-- 无：llm-provider 的 ToolDefinition 类型被本 change 消费，其 requirement 不变 -->

## Impact

- 新增 `packages/core/src/tools/`（Tool 接口、ToolRegistry、Zod→JSON Schema 转换）。
- 消费 `packages/core/src/llm/types.ts` 的 `ToolDefinition` 类型（衔接上一 change）。
- 依赖：`zod`（已在 `@lhx-agent-engine/core` 声明，使用其内置 `toJSONSchema`，**不新增三方依赖**）。
- 新增 `packages/core/tests/` 下的单元测试。
- 无 breaking changes（core 包当前仅有 llm 模块）。
