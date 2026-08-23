# @agent-engine/core

Agent kernel execution engine. Hosts the LLM Provider abstraction, Tool registry, single-agent ReAct loop, and hooks pipeline.

## Implemented modules

### `llm` — LLM Provider abstraction

- `createProvider(config)`: dispatches by `provider` (openai-compatible / anthropic / custom).
- Normalized types: `ChatMessage` / `ToolCall` / `ToolDefinition` / `ChatCompletionParams` / `ChatCompletionResult` / `TokenUsage`.
- DeepSeek by default (`baseURL` falls back to `https://api.deepseek.com`); API keys read from env (`DEEPSEEK_API_KEY` falling back to `OPENAI_API_KEY`; Anthropic reads `ANTHROPIC_API_KEY`).

### `tools` — Tool registry

- `Tool` interface: `name` / `description` / `inputSchema` (Zod) / `execute`.
- `ToolRegistry`: `register` / `get` / `has` / `list` / `execute(name, argsJson)` / `toToolDefinitions()`.
- Execution chain: JSON string → `JSON.parse` → `inputSchema.parse` validation → `execute`.
- Zod → JSON Schema via built-in `toJSONSchema` (no third-party dependency).

### `agent` — single-agent ReAct loop

- `AgentLoop`: LLM call → tool dispatch → result feedback → loop.
- Termination: no `tool_calls` (natural end) or `maxSteps` (default 10).
- Tool failures are fed back as error results (`Error: ...`) without terminating the loop.

### `hooks` — lifecycle hooks pipeline

- `Hook` interface: `beforeLLM` / `afterLLM` / `beforeToolCall` / `afterToolCall` / `onStepEnd` / `onError`.
- Rewrite semantics: returns `T | void` (new value rewrites, void keeps); chained execution.
- **No blocking** — blocking is the job of rules (guardrail).

## Not yet implemented (directory placeholders)

`mcp` (MCP client), `memory` (session + long-term), `skills`, `plugins`, `rules`, `context` (system-prompt assembly), `events` (event bus).

## API

```ts
import { createProvider, ToolRegistry, AgentLoop, HookPipeline } from '@agent-engine/core';
```

## Design notes

- **Self-built kernel + SDK reuse**: loop / orchestration / plugins / hooks / rules are self-built; LLM / MCP / vectors reuse official SDKs.
- **Capability layers**: tools / skills / mcp (capabilities) → plugins (extensions) → hooks / rules (controls) → system-prompt / memory (context).
- **Multi-model boundary**: `LLMProvider` only covers chat; embedding is a separate abstraction (`EmbeddingProvider`) to be introduced later.

## Dependencies

- `@agent-engine/config` (`ModelConfig` type)
- `openai` / `@anthropic-ai/sdk` (LLM SDKs)
- `@modelcontextprotocol/sdk` (MCP, later)
- `pino` / `zod`

## Status

🚧 Partially implemented (M1 done: llm / tools / agent / hooks; M2 in progress).
