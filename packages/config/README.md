# @lhx-agent-engine/config

Config loading and schema. Normalizes YAML / JSON5 / TypeScript into a single `AgentConfig` (Zod-validated, deep-frozen).

## Install

```bash
pnpm add @lhx-agent-engine/config
```

## Capabilities

- **`AgentConfigSchema`**: Zod schemas for every config axis — `model` / `systemPrompt` / `rules` / `guardrails` / `tools` / `mcp` / `skills` / `memory` / `cache` / `embedding` / `hooks` / `plugins` / `orchestration` / `execution` / `security`, with TS types derived via `z.infer`.
- **`loadAgentConfig(path, options?)`**: selects a parser by extension, validates via Zod, and throws readable errors on failure.
- **`deepFreeze` / `sanitizeConfigValue`**: reuse for defense-in-depth at any config boundary.

## Subpath exports

| Subpath                           | Contents                                                                    |
| --------------------------------- | --------------------------------------------------------------------------- |
| `@lhx-agent-engine/config`        | `AgentConfigSchema`, `loadAgentConfig`, `deepFreeze`, `sanitizeConfigValue` |
| `@lhx-agent-engine/config/schema` | All Zod schemas + inferred types                                            |

## API

```ts
import { AgentConfigSchema, loadAgentConfig } from '@lhx-agent-engine/config';

const config = await loadAgentConfig('./agents/devops-agent.yaml');
// config: AgentConfig (type derived from z.infer, deep-frozen / immutable)

// TypeScript config is denied by default; opt in explicitly:
const tsConfig = await loadAgentConfig('./agents/local.ts', { allowTsConfig: true });
```

## Security defaults

- **TypeScript denied by default**: `.ts`/`.mts`/`.cts` files are executed as code; load only with `allowTsConfig: true` for trusted local inputs.
- **Sanitize on entry**: dangerous keys (`__proto__`/`constructor`/`prototype`) are stripped recursively before validation to prevent prototype pollution.
- **`deepFreeze` on exit**: the validated config is deeply frozen against runtime tampering.
- **Resource limits**: file size capped before parsing (default 1 MiB); YAML uses explicit `maxAliasCount` + `uniqueKeys` to block alias bombs and duplicate keys.

## Design notes

- **Zod 4 single source of truth**: all schemas defined in Zod, types derived via `z.infer`; frontend forms/editors reuse the same schema.
- **Three-format normalization**: `.yaml` → `yaml`, `.json`/`.json5` → `json5` (comment-tolerant), `.ts` → `jiti`; all three produce an equivalent `AgentConfig`.
- **Multi-model design (capability split + per-instance override)**: default `model` (chat); `embedding` is a separate field (capability axis); subagent models override per-subagent (role axis). See `AGENTS.md` 7.3.

## Dependencies

- `zod` (schema validation)
- `yaml` / `json5` / `jiti` (three-format parsing)

## Status

✅ Implemented.
