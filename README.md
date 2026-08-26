# Agent Engine

A universal, configurable **Agent kernel execution engine (harness)**.

In one line: **Configuration as Agent** — make `plugins` / `mcp` / `skills` / `tools` / `system-prompt` / `memory` / `rules` / `hooks` all configurable, so building a vertical-domain Agent later only requires **writing constraints and rules, with zero kernel changes**.

## Features

- **Eight configurable axes**: capabilities (`tools` / `skills` / `mcp`), extensions (`plugins`), controls (`hooks` / `rules` / `guardrails`), context (`system-prompt` / `memory`), all wired from declarative config.
- **Three config formats**: YAML / JSON5 / TypeScript normalized into a single `AgentConfig` (Zod-validated, deep-frozen).
- **Pluggable provider / backends**: LLM (DeepSeek by default, OpenAI-compatible; Anthropic / ollama pluggable), memory / cache / vector store / embedding / retrieval / session store / logger — every backend is an interface + in-memory default + injection point.
- **Single-agent ReAct loop** with hooks lifecycle, guardrail interception, Human-in-the-loop approval, streaming, cancellation and execution budgets.
- **Three-tier memory**: token-budget window compaction → rolling summary → semantic recall (embedding + vector store).
- **Document ingestion**: normalize heterogeneous docs to Markdown → chunk → BM25 retrieval injected into context (config `documents` axis; semantic recall deferred to embedding).
- **Execution sandbox**: native commands via docker/nsjail; untrusted WASI code via `FunctionSandbox` (`node:wasi`, zero Docker).
- **Spec-driven development**: follows OpenSpec (propose → apply → archive).

## Architecture

```text
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
pnpm test               # run Rstest tests
pnpm lint               # Rslint lint
pnpm typecheck          # tsc --noEmit type check
pnpm spell              # cspell spell check
pnpm lint:md            # markdownlint
```

## Packages

| Package                      | Description                                                  | Status                   |
| ---------------------------- | ------------------------------------------------------------ | ------------------------ |
| `@agent-engine/config`       | Config schema + three-format loader                          | ✅ implemented           |
| `@agent-engine/core`         | Kernel engine (LLM / tools / agent loop / hooks / rules)     | ✅ implemented           |
| `@agent-engine/server`       | HTTP server (REST + streaming)                               | ✅ implemented           |
| `@agent-engine/plugin-files` | Local file tools (`read_file` / `write_file` / `list_files`) | ✅ implemented           |
| `@agent-engine/plugin-bash`  | Sandboxed command execution (`bash`)                         | ✅ implemented           |
| `@agent-engine/plugin-git`   | Git tool suite (read-only by default, sandboxed)             | ✅ implemented           |
| `@agent-engine/plugin-otel`  | OpenTelemetry observability plugin                           | 📦 scaffold              |
| `@agent-engine/cli`          | CLI entry                                                    | 📦 scaffold              |
| `@agent-engine/web`          | Integrated platform (`apps/web`)                             | 🚧 partially implemented |
| `@agent-engine/docs`         | Docs site (Rspress)                                          | 📦 scaffold              |

## Milestones

1. **M1 Kernel skeleton** ✅: monorepo + config (schema/loader) + core (LLM Provider / Tool registry / Agent Loop).
2. **M2 Configurable capabilities** ✅: hooks / rules / skills / plugins + system-prompt assembly + session memory + built-in tools + execution sandbox.
3. **M3 Extensions** 🚧: MCP client ✅, resolve layer ✅, streaming ✅, session lifecycle ✅, loop hardening ✅, reasoning transparency ✅, three-tier memory ✅, FunctionSandbox ✅, guardrail config axis ✅, pluggable session store / logger ✅. Remaining: multi-agent orchestration.
4. **M4 Services** 🚧: server HTTP API ✅. Remaining: CLI.
5. **M5 Platform & docs** 🚧: `apps/web` ✅. Remaining: docs, Docker orchestration, example agents.

## Docs

- [`AGENTS.md`](./AGENTS.md) — authoritative project doc (architecture, conventions); read before developing.
- [`docs/`](./docs) — Rspress docs site.
- [`openspec/`](./openspec) — spec-driven development (specs / changes).

## License

TBD.
