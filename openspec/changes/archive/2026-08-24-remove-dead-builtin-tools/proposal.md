## Why

`slim-builtin-tools-plugin-files-bash` 把 `json` / `base64` / `calculator` / `sitesearch` 从内置注册表移除时，选择「实现保留在 `tools/builtin/` 供 plugin 复用」，但至今没有任何 plugin 复用它们，反而留下死代码与矛盾注释。同时 `read_file` / `write_file` / `bash` 迁到 plugin 包后，`builtin-tools` 主 spec 仍把它们（连同 calculator/json/base64/sitesearch）描述为「内置工具」，形成 spec 漂移。

## What Changes

- 彻底删除 4 个死文件：`tools/builtin/{base64,calculator,json,sitesearch}.ts`。
- 清理引用：`core/src/types.ts` 的 4 组 re-export、`tools/builtin/index.ts` 注释、`builtin-tools.test.ts` 里 calculator/json/base64/sitesearch 的用例与 import、`apps/web/src/config/ToolsForm.tsx` 的死工具预设。
- 移除仅 calculator 使用的 `expr-eval` 依赖。
- 修正 `builtin-tools` 主 spec 漂移：REMOVE 仍被描述为「内置工具」的 `read_file` / `write_file` / `bash` / `calculator` / `json` / `base64` / `sitesearch` 需求，并把「统一装配」里的「实现保留」改为「已彻底删除」。

## Capabilities

### Modified Capabilities

- `builtin-tools`: 删除死文件、修正 spec（read_file/write_file/bash 迁出、calculator/json/base64/sitesearch 删除）。

## Impact

- 修改 `packages/core/src/tools/builtin/`（删 4 文件）、`core/src/types.ts`、`core/tests/builtin-tools.test.ts`、`core/package.json`。
- 修改 `apps/web/src/config/ToolsForm.tsx`。
- **Breaking**：`json` / `base64` / `calculator` / `sitesearch` 的 `builtin.*` 工具名彻底消失（原本就未注册，仅删除源码与预设）。
