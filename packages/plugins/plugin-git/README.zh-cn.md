# @agent-engine/plugin-git

Git 工具套件插件：注册单个 `git` 工具，默认只读子命令（`status` / `diff` / `log` / `show` / `branch` / `remote` / `rev-parse` / `ls-files` / `blame`），破坏性子命令（`commit` / `push` / `checkout` / `reset` / `clean` / `merge` / `rebase` …）阻断；经 `SandboxBackend` 隔离执行，可经 rtk 压缩输出。

## 安装

```bash
pnpm add @agent-engine/plugin-git
```

## 用法

```ts
import { createGitPlugin } from '@agent-engine/plugin-git';
import { resolveSandboxBackend } from '@agent-engine/core';

const resolution = resolveSandboxBackend('auto', { compact: true });
if (!resolution.available) throw new Error('无可用沙箱');

const gitPlugin = createGitPlugin({
  sandbox: resolution.backend,
  // policy / compact 可选
});

// 装配时传入 plugins: [gitPlugin]
```

## 安全

- 默认只读白名单，破坏性子命令黑名单阻断。
- 经沙箱隔离执行（`workspaceRoot` 挂载、资源限制、网络默认关闭）。
- `compact: true` 时以 rtk 包装命令压缩输出，需沙箱镜像安装 rtk。
