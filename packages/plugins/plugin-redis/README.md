# @agent-engine/plugin-redis

Redis cache backend: implements core's `CacheBackend` (TTL KV) with JSON serialization and key-namespace isolation.

## Install

```bash
pnpm add @agent-engine/plugin-redis
```

## Usage

Connection URL is read from `REDIS_URL` by default (falls back to `redis://localhost:6379`).

```ts
import { createRedisPlugin } from '@agent-engine/plugin-redis';

const plugin = createRedisPlugin({ url: process.env.REDIS_URL });
```

`preset-default` already wires the factory (`@agent-engine/plugin-redis`). Activate it per-agent via `plugins` and select the cache backend by name:

```yaml
plugins:
  - '@agent-engine/plugin-redis'
cache:
  backend: redis
```

## API

- `createRedisPlugin(config?)` — returns a `Plugin` that registers `RedisCacheBackend` (name `redis`).
- `RedisCacheBackend` — implements `CacheBackend` (`get` / `set` / `delete` / `clear`); TTL via `SET key value PX ttlMs`.
- `createRedis(config?)` — creates the ioredis connection.

## Notes

- Session state (`SessionStoreBackend`) holds an in-memory `AgentLoop` object that is not serializable across processes — it stays on the server layer (see AGENTS.md 15.4).
