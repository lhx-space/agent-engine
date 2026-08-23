# Agent Engine

A universal, configurable **Agent kernel execution engine (harness)**.

In one line: **Configuration as Agent** — make `plugins` / `mcp` / `skills` / `tools` / `system-prompt` / `memory` / `rules` / `hooks` all configurable, so building a vertical-domain Agent later only requires **writing constraints and rules, with zero kernel changes**.

## Features

- **Eight configurable axes**: capabilities (tools / skills / mcp), extensions (plugins), controls (hooks / rules), context (system-prompt / memory), decoupled by layer.
- **Three config formats**: YAML / JSON5 / TypeScript normalized into a single `AgentConfig` (Zod-validated).
- **Pluggable LLM Provider**: DeepSeek by default (OpenAI-compatible), Anthropic / ollama pluggable; no LangChain (self-built kernel + SDK reuse).
- **Single-agent ReAct loop**: LLM call → tool dispatch → result feedback → loop, with a hooks lifecycle pipeline.
- **Spec-driven development**: follows OpenSpec (propose → apply → archive).

## Architecture

```
                ┌── cli
config ← core ←┼── server ──(HTTP API)──▶ apps/web (React 19 + Rsbuild)
                └── plugins

docs/ (Rspress) is a standalone site
```

Dependency direction is one-way: `config ← core ← cli / server ←(HTTP API) apps/web`.

## Quick Start

```bash
pnpm install            # install dependencies
pnpm build              # build all packages with tsdown
pnpm test               # run Vitest tests
pnpm lint               # Rslint lint
pnpm typecheck          # tsc --noEmit type check
```

## Packages

| Package                     | Description                                      | Status                   |
| --------------------------- | ------------------------------------------------ | ------------------------ |
| `@agent-engine/config`      | Config schema + three-format loader              | ✅ implemented           |
| `@agent-engine/core`        | Kernel engine (LLM / tools / agent loop / hooks) | 🚧 partially implemented |
| `@agent-engine/cli`         | CLI entry                                        | 📦 scaffold              |
| `@agent-engine/server`      | HTTP server (Docker)                             | 📦 scaffold              |
| `@agent-engine/plugin-otel` | OpenTelemetry plugin                             | 📦 scaffold              |
| `@agent-engine/web`         | Integrated platform (apps/web)                   | 📦 scaffold              |
| `@agent-engine/docs`        | Docs site (Rspress)                              | 📦 scaffold              |

## Milestones

1. **M1 Kernel skeleton** ✅: monorepo + config (schema/loader) + core (LLM Provider / Tool registry / Agent Loop).
2. **M2 Configurable capabilities** 🚧: hooks pipeline ✅ → rules engine → system-prompt assembly → skills / plugins → session memory → built-in tools.
3. **M3 Extensions**: MCP client, long-term memory (pgvector), multi-agent orchestration.
4. **M4 Services**: server + CLI.
5. **M5 Platform & docs**: apps/web + docs + Docker + examples.

## Docs

- [`AGENTS.md`](./AGENTS.md) — authoritative project doc (architecture, conventions); read before developing.
- [`docs/`](./docs) — Rspress docs site.
- [`openspec/`](./openspec) — spec-driven development (specs / changes).

## License

TBD.
