# @lhx-agent-engine/preset-default

默认全家桶：聚合全部能力插件（rules / skills / documents / memory / web / mcp）+ 安全工具（files / bash / git）+ 声明式 guardrails，一行配置还原今天的能力。

## 安装

```bash
pnpm add @lhx-agent-engine/preset-default
```

## 用法

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

- `createPresetPluginFactories(config)` — 返回全部插件的 `Record<string, PluginFactory>`。
- `defaultCapabilityPlugins(config)` — 返回按 config 切片激活的能力插件名（D1-A 零迁移）。
- `createPresetLongTermMemoryFactory()` — 返回 `LongTermMemory` 工厂（SemanticMemory）。
