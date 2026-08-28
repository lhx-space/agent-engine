# @lhx-agent-engine/preset-default

Default "full set" preset: aggregates all capability plugins (rules / skills / documents / memory / web / mcp) plus safety tools (files / bash / git) and declarative guardrails, so a single config restores today's capabilities.

## Install

```bash
pnpm add @lhx-agent-engine/preset-default
```

## Usage

```ts
import {
  createPresetLongTermMemoryFactory,
  createPresetPluginFactories,
  defaultCapabilityPlugins,
} from '@lhx-agent-engine/preset-default';
import { resolveAgentConfig } from '@lhx-agent-engine/core';

const resolved = await resolveAgentConfig(config, {
  pluginFactories: createPresetPluginFactories(config),
  defaultPlugins: defaultCapabilityPlugins(config),
  longTermMemoryFactory: createPresetLongTermMemoryFactory(),
});
```

## API

- `createPresetPluginFactories(config)` — returns `Record<string, PluginFactory>` for all plugins.
- `defaultCapabilityPlugins(config)` — returns capability plugin names activated by config slices (D1-A zero migration).
- `createPresetLongTermMemoryFactory()` — returns a `LongTermMemory` factory (SemanticMemory).
