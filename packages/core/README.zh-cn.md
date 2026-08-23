# @agent-engine/core

Agent 内核执行引擎。承载 LLM Provider 抽象、Tool 注册表、单 Agent ReAct 循环、hooks 管线。

## 已实现模块

### `llm` — LLM Provider 抽象

- `createProvider(config)`：按 `provider` 分派（openai-compatible / anthropic / custom）。
- 归一化类型：`ChatMessage` / `ToolCall` / `ToolDefinition` / `ChatCompletionParams` / `ChatCompletionResult` / `TokenUsage`。
- 默认 DeepSeek（`baseURL` 缺省 `https://api.deepseek.com`）；密钥从环境变量读（`DEEPSEEK_API_KEY` 回退 `OPENAI_API_KEY`，Anthropic 读 `ANTHROPIC_API_KEY`）。

### `tools` — Tool 注册表

- `Tool` 接口：`name` / `description` / `inputSchema`（Zod）/ `execute`。
- `ToolRegistry`：`register` / `get` / `has` / `list` / `execute(name, argsJson)` / `toToolDefinitions()`。
- 工具执行链路：JSON 字符串 → `JSON.parse` → `inputSchema.parse` 校验 → `execute`。
- Zod → JSON Schema 用内置 `toJSONSchema`（无三方依赖）。

### `agent` — 单 Agent ReAct 循环

- `AgentLoop`：LLM 调用 → 工具派发 → 结果回填 → 循环。
- 终止条件：无 `tool_calls`（自然结束）或 `maxSteps`（默认 10）。
- 工具失败回填错误结果（`Error: ...`），不终止循环。

### `hooks` — 生命周期钩子管线

- `Hook` 接口：`beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` / `onStepEnd` / `onError`。
- 可改写语义：返回 `T | void`（新值改写、void 保持）；链式执行。
- **不做阻断**——阻断是 rules（guardrail）的职责。

## 未实现（目录占位，后续 change）

`mcp`（MCP client）、`memory`（会话 + 长期记忆）、`skills`、`plugins`、`rules`、`context`（system-prompt 组装）、`events`（事件总线）。

## API

```ts
import { createProvider, ToolRegistry, AgentLoop, HookPipeline } from '@agent-engine/core';
```

## 设计要点

- **内核自研 + SDK 复用**：执行循环 / 编排 / 插件 / hooks / rules 自研；LLM / MCP / 向量等能力复用官方 SDK。
- **能力分层**：tools / skills / mcp（能力）→ plugins（扩展）→ hooks / rules（控制）→ system-prompt / memory（上下文）。
- **多模型边界**：`LLMProvider` 只覆盖 chat；embedding 是另一个抽象（`EmbeddingProvider`），后续引入。

## 依赖

- `@agent-engine/config`（`ModelConfig` 类型）
- `openai` / `@anthropic-ai/sdk`（LLM SDK）
- `@modelcontextprotocol/sdk`（MCP，后续）
- `pino` / `zod`

## 状态

🚧 部分实现（M1 完成：llm / tools / agent / hooks；M2 进行中）。
