# @lhx-agent-engine/plugin-files

本地文件工具套件插件：注册 `read_file` / `write_file` / `list_files`，受 `security.files.roots` 约束。

## 安装

```bash
pnpm add @lhx-agent-engine/plugin-files
```

## 用法

```ts
import { createFilesPlugin } from '@lhx-agent-engine/plugin-files';

const filesPlugin = createFilesPlugin({
  roots: ['/workspace'],
  maxFileBytes: 1_048_576,
});

// 装配时传入 plugins: [filesPlugin]
```

> 在配置中声明即可由 server 自动装配：
>
> ```yaml
> plugins:
>   - '@lhx-agent-engine/plugin-files'
> security:
>   files:
>     roots: [/workspace]
> ```

## 安全

- `read_file` / `list_files` 只读且受 `roots` 约束。
- `write_file` 在 `roots` 内写入，并强制 `maxFileBytes`。
