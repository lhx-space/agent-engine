# @agent-engine/plugin-bash

沙箱命令执行插件：注册单个 `bash` 工具，受 `security.bash.enabled` 门控、`allowCommands` / `denyPatterns` / `allowNetwork` 约束，经 `SandboxBackend` 隔离执行。

## 安装

```bash
pnpm add @agent-engine/plugin-bash
```

## 用法

```ts
import { createBashPlugin } from '@agent-engine/plugin-bash';
import { resolveSandboxBackend } from '@agent-engine/core';

const resolution = resolveSandboxBackend('auto');
if (!resolution.available) throw new Error('无可用沙箱');

const bashPlugin = createBashPlugin(
  {
    enabled: true,
    allowCommands: ['kubectl', 'git', 'ls', 'cat'],
    denyPatterns: ['rm -rf'],
    allowNetwork: false,
  },
  resolution.backend,
);

// 装配时传入 plugins: [bashPlugin]
```

> 在配置中声明即可由 server 自动装配：
>
> ```yaml
> plugins:
>   - '@agent-engine/plugin-bash'
> security:
>   bash:
>     enabled: true
>     allowCommands: [kubectl, git, ls, cat]
> ```

## 安全

- 默认禁用（`security.bash.enabled: false`）；未开启时插件抛错。
- **沙箱不可用即禁用**——绝不回退宿主进程裸奔。
- 命令输出可经 `rtk` 压缩（`security.sandbox.compact`）。
