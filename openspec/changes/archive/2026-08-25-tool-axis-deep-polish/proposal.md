## Why

`tools` 是八大可配置项之一，但当前这条轴是「死配置」：`config.tools` 被 Schema 解析后从未被 resolve/assemble 消费——既不能按名禁用内置工具，其 `{ use }` 引用字段也无任何消费方（spec 与代码、UI 三层漂移：`plugins` spec 写「按 `tools` 引用装配内置工具」，实际 `registerBuiltinTools` 恒注册四原语、不读 `tools`；前端 `ToolsForm` 仍在提示 `builtin.read_file` 这种早已 plugin 化的陈旧工具名）。同时文件/命令/时间三个高频工具各有缺口：`plugin-files` 只有 `read_file`/`write_file`，缺「发现文件」的 `list_files`（没有列举能力就无法定位要读哪个文件）；`datetime now` 只返回 ISO+epochMs，模型要回答「现在几点/星期几」还得二次 `format`；`read_file` 截断按字节硬切可能切断多字节 UTF-8 字符产生乱码；`file.ts`/`bash.ts` 已迁出为 plugin 工厂却仍躺在 `builtin/` 目录，与「不再内置」的语义相悖。

## What Changes

- `config.tools` 从「无消费方的 `ToolRef[]`」演进为真工具开关轴：`tools.disabled`（按语义名禁用任意已装配工具，含 builtin / plugin / mcp）。
- `assembleAgentLoop` 在装配末按 `tools.disabled` 移除工具，并在 `todo` 被禁用时不再注入规划引导片段。
- `@lhx-agent-engine/plugin-files` 新增 `list_files` 工具：受 `roots` 约束的目录列举 + 可选 `glob` 过滤 + `maxDepth`/`maxEntries` 防护（复用 `picomatch` 做 glob）。
- `datetime now` 支持 `timeZone`/`locale`，直接返回 `formatted` 完整本地化串（星期+日期+时分秒），免二次调用。
- `read_file` 截断改为 UTF-8 安全边界（不切断多字节字符）。
- 源码归位：`tools/builtin/{file,bash}.ts` → `tools/{file,bash}.ts`（它们已是 plugin 工厂，不再属于「内置」）。

## Capabilities

### Modified Capabilities

- `agent-config-schema`: `tools` 子 Schema 由 `ToolRef[]` 改为 `{ disabled: string[] }`（移除未消费的 `ToolRef`/`use`）。
- `builtin-tools`: `datetime now` 支持 `timeZone`/`locale` 本地化输出；`read_file` UTF-8 安全截断。
- `plugins`: `@lhx-agent-engine/plugin-files` 新增 `list_files`；修正 `assembleAgentLoop` 装配语义（`tools.disabled` 装配末移除 + todo 引导按需注入）。

## Impact

- `packages/config/src/schema/index.ts`：`ToolsConfigSchema`（`disabled`）+ 移除 `ToolRefSchema`。
- `packages/core/src/agent/assemble.ts`、`resolve/resolve.ts`：接线 `tools.disabled`。
- `packages/core/src/tools/builtin/{file,bash}.ts` → `tools/{file,bash}.ts`（git mv），新增 `list_files`、UTF-8 安全截断。
- `packages/core/src/tools/builtin/datetime.ts`：`now` 本地化。
- `packages/core/src/{index,types}.ts`：路径与类型同步。
- `packages/core/package.json`：新增 `picomatch` 依赖。
- `packages/plugins/files/src/index.ts`：注册 `list_files`。
- `apps/web/src/config/ToolsForm.tsx`、`lib/export-config.ts`：`tools.disabled` 多选 + 序列化。
- 测试：`builtin-tools.test.ts`、`schema.test.ts`、`resolve.test.ts`、`streaming.test.ts`、`files.test.ts`。
- **Breaking**：`tools` 字段结构由数组改为对象（旧 `{ use }` 无任何运行期消费方，仅测试/前端占位，迁移成本为 0）。
