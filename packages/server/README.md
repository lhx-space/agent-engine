# @agent-engine/server

Agent Engine HTTP server (Docker deployment). Exposes REST + streaming APIs over Hono, driving `@agent-engine/core`.

## Install

```bash
pnpm add @agent-engine/server
```

## Endpoints

| Method   | Path                      | Description                                                                     |
| -------- | ------------------------- | ------------------------------------------------------------------------------- |
| `GET`    | `/health`                 | Liveness probe → `{ ok: true }`                                                 |
| `POST`   | `/api/agent/run`          | Non-streaming run: `{ config, input, sessionId? }` → `{ sessionId, ...result }` |
| `POST`   | `/api/agent/run/stream`   | NDJSON streaming run (`application/x-ndjson`), header `x-session-id`            |
| `DELETE` | `/api/agent/sessions/:id` | End and dispose a session → `{ ok: true }`                                      |

## Usage

```ts
import { createApp, serve } from '@agent-engine/server';
import { pino } from 'pino'; // optional

const app = createApp({
  // override/extend the preset plugin factories or providerFactory here
  sessionStore: mySessionStore, // SessionStoreBackend (default InMemorySessionStore)
  logger: pino(), // Logger (default consoleLogger)
});

serve({/* ServerOptions */}, 8080);
```

## Pluggable

- **`SessionStoreBackend`** — session lifecycle (reuse / TTL / LRU eviction). Default `InMemorySessionStore`; redis etc. implement the same interface.
- **`Logger`** — info/warn/error/debug. Default `consoleLogger`; pino / winston / OTel are injected via `options.logger` (logging is not a kernel concern — observability lives in the events bus + hooks).

## Notes

- Capability plugins are wired by default via `@agent-engine/preset-default` (`createPresetPluginFactories` + `defaultCapabilityPlugins` + `createPresetLongTermMemoryFactory`); override or append via `options.pluginFactories` / `options.longTermMemoryFactory`.
- `envProviderFactory` resolves the LLM provider from environment variables (DeepSeek default).

## Status

✅ Implemented (REST + streaming + session lifecycle + pluggable store/logger).
