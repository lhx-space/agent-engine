# @agent-engine/plugin-git

Git tool-suite plugin: registers a single `git` tool, read-only subcommands by default (`status` / `diff` / `log` / `show` / `branch` / `remote` / `rev-parse` / `ls-files` / `blame`), destructive subcommands (`commit` / `push` / `checkout` / `reset` / `clean` / `merge` / `rebase` …) blocked; runs through `SandboxBackend` with optional rtk output compaction.

## Install

```bash
pnpm add @agent-engine/plugin-git
```

## Usage

```ts
import { createGitPlugin } from '@agent-engine/plugin-git';
import { resolveSandboxBackend } from '@agent-engine/core';

const resolution = resolveSandboxBackend('auto', { compact: true });
if (!resolution.available) throw new Error('no sandbox available');

const gitPlugin = createGitPlugin({
  sandbox: resolution.backend,
  // policy / compact are optional
});

// then assemble with plugins: [gitPlugin]
```

## Security

- Read-only allowlist by default; destructive subcommands are blocked.
- Runs inside the sandbox (`workspaceRoot` mount, resource limits, network off by default).
- `compact: true` wraps the command with `rtk` to compress output (the sandbox image must ship `rtk`).
