# @agent-engine/config

Config loading and schema. Normalizes YAML / JSON5 / TypeScript into a single `AgentConfig` (Zod-validated).

## Capabilities

- **`AgentConfigSchema`**: Zod schemas for the eight configurable axes (model / systemPrompt / rules / tools / mcp / skills / memory / hooks / plugins / orchestration), with TS types derived via `z.infer`.
- **`loadAgentConfig(path)`**: selects a parser by extension, validates via Zod, and throws readable errors on failure.

## API

```ts
import { AgentConfigSchema, loadAgentConfig } from '@agent-engine/config';

const config = await loadAgentConfig('./agents/devops-agent.yaml');
// config: AgentConfig (type derived from z.infer)
```

## Design notes

- **Zod 4 single source of truth**: all schemas defined in Zod, types derived via `z.infer`; frontend forms/editors reuse the same schema.
- **Three-format normalization**: `.yaml` → `yaml`, `.json`/`.json5` → `json5` (comment-tolerant), `.ts` → `jiti`; all three produce an equivalent `AgentConfig`.
- **Multi-model design (capability split + per-instance override)**: default `model` (chat); embedding uses a separate field (capability axis); subagent models override per-subagent (role axis). See `AGENTS.md` 7.3.

## Dependencies

- `zod` (schema validation + `toJSONSchema`)
- `yaml` / `json5` / `jiti` (three-format parsing)

## Status

✅ Implemented (M1).
