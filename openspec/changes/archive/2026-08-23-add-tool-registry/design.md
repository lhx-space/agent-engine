## Context

`core` 包已有 LLM Provider 层（`llm/`），其中 `ToolDefinition` 定义了给 LLM 的工具描述（JSON Schema 参数）。本 change 引入「工具」这一层：`Tool` 接口 + `ToolRegistry`，是 Agent Loop 执行工具调用的前置依赖，也是 plugins/skills/mcp 工具的最终汇聚点（AGENTS.md 5.1 能力层）。

关键衔接：`Tool.inputSchema`（Zod）需要转成 `ToolDefinition.parameters`（JSON Schema）才能喂给 LLM；LLM 返回的 `function.arguments`（JSON 字符串）需要经过 Zod 校验才能安全地调用 `execute`。

## Goals / Non-Goals

**Goals:**

- 定义通用的 `Tool` 接口与 `ToolRegistry` 注册表。
- 实现 Zod → JSON Schema 转换（复用 Zod 4 内置能力）。
- 实现工具执行链路：JSON 字符串参数 → 解析 → 校验 → 执行 → 结果。

**Non-Goals:**

- 不实现内置工具（read_file / bash / web_search 等）——本 change 只做接口与注册表，内置工具后续 change 或作为插件接入。
- 不实现工具的权限/沙箱控制——留待 rules/guardrail（M2）。
- 不实现工具调用的并发/重试策略——留待 Agent Loop。

## Decisions

### D1: `inputSchema` 用 Zod 而非 JSON Schema

**选择**：`Tool.inputSchema` 用 Zod schema。

**理由**：与 config 包「Schema 一律用 Zod」的单一事实来源保持一致；Zod 可同时用于「运行时校验」与「转 JSON Schema 给 LLM」，一份定义两用。

**备选**：直接存 JSON Schema。缺点：失去运行时类型校验能力，且与项目 Zod 约定冲突。**否决**。

### D2: Zod → JSON Schema 用内置 `toJSONSchema`

**选择**：使用 Zod 4 内置的 `toJSONSchema(schema, { target })`。

**理由**：Zod 4 已内置（`json-schema-processors` 导出，支持 draft-2020-12 / draft-07 / openapi-3.0），**不引入 `zod-to-json-schema` 三方库**，符合「复用优先」。

**备选**：引 `zod-to-json-schema`。缺点：额外依赖，且该库主要面向 Zod 3，Zod 4 已内置。**否决**。

### D3: `execute` 接收 JSON 字符串参数

**选择**：`ToolRegistry.execute(name, argsJson: string)` 接收 JSON 字符串（即 LLM 返回的 `function.arguments`），内部 `JSON.parse` + `inputSchema.parse` 校验后调用 `Tool.execute`。

**理由**：LLM 的工具调用参数天然是 JSON 字符串，注册表在此统一做解析与校验，工具实现只关心强类型输入。

### D4: 首版不做内置工具

**选择**：只做 `Tool` 接口 + `ToolRegistry`，不含任何内置工具实现。

**理由**：内置工具（bash/read_file 等）有安全敏感性与环境依赖，应作为独立 change 或插件；本 change 聚焦「机制」而非「具体工具」。

## Risks / Trade-offs

- [Zod 4 `toJSONSchema` 的 target 与 OpenAI 兼容性] → 默认用 `draft-2020-12`；如某些 Provider 只认 draft-07，再通过参数切换，先用测试锁定输出结构。
- [工具 `execute` 抛错时的处理] → `ToolRegistry.execute` 捕获后抛包含工具名与原因的错误，供 Agent Loop 回填错误结果。
- [`inputSchema.parse` 失败（LLM 参数非法）] → 抛出含工具名与 Zod 校验原因的错误，回填给 LLM 让其修正。

## Migration Plan

无迁移。core 包当前仅有 llm 模块，直接新增 `tools/` 模块并导出。

## Open Questions

- 无（内置工具、权限控制、并发策略已在 Non-Goals 明确留待后续）。
