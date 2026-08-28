# @lhx-agent-engine/plugin-bash

Sandboxed command-execution plugin: registers a single `bash` tool, gated by `security.bash.enabled`, constrained by `allowCommands` / `denyPatterns` / `allowNetwork`, and run through `SandboxBackend`.

## Install

```bash
pnpm add @lhx-agent-engine/plugin-bash
```

## Usage

```ts
import { createBashPlugin } from '@lhx-agent-engine/plugin-bash';
import { resolveSandboxBackend } from '@lhx-agent-engine/core';

const resolution = resolveSandboxBackend('auto');
if (!resolution.available) throw new Error('no sandbox available');

const bashPlugin = createBashPlugin(
  {
    enabled: true,
    allowCommands: ['kubectl', 'git', 'ls', 'cat'],
    denyPatterns: ['rm -rf'],
    allowNetwork: false,
  },
  resolution.backend,
);

// then assemble with plugins: [bashPlugin]
```

> Declare it in your config to have the server wire it automatically:
>
> ```yaml
> plugins:
>   - '@lhx-agent-engine/plugin-bash'
> security:
>   bash:
>     enabled: true
>     allowCommands: [kubectl, git, ls, cat]
> ```

## Security

- Disabled by default (`security.bash.enabled: false`); the plugin throws if enabled is missing.
- **Sandbox unavailable ⇒ disabled** — never falls back to running on the host.
- Command output can be compacted via `rtk` (`security.sandbox.compact`).
