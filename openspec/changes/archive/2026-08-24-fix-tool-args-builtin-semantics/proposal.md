## Why

流式运行暴露了三个问题：

1. **致命崩溃**：模型流式下发了 `arguments: ""` 的工具调用，空参数被回填进历史消息，下一轮请求时服务端 `JSON.parse("")` 失败 → 400 `Unexpected end of JSON input` → 整个 run 崩溃。
2. **语义错误**：`registerBuiltinTools` 用 `tools` 配置过滤内置工具，一旦用户显式写了 `tools: [{ use: builtin.read_file }]`，其余内置工具反而被过滤掉。这与「内置工具默认全有、`tools` 只是横向拓展」的语义冲突。
3. **read_file 形同虚设**：默认 `files.roots` 为空，read_file 一律报 `No allowed file roots configured`，模型反复重试无果。

## What Changes

- `ToolRegistry.execute`：空/非法 JSON 入参兜底为 `{}`（不再抛 invalid JSON）。
- `AgentLoop`：执行工具前，把空/非法 `arguments` 规范化为 `{}`，且回填历史前规范化——避免空参数污染历史导致下一轮 400。
- `registerBuiltinTools`：**移除 `tools` 过滤**，内置工具始终全注册（todo + read_file + write_file + web_search + web_fetch + sitesearch + calculator + datetime + json + base64；bash 仍由 `security.bash.enabled` 控制）。
- `tools` 配置改为「额外工具引用」的横向拓展语义（`builtin.*` 不再用于过滤，预留非内置工具引用）。
- 默认 demo 配置补 `files.roots`。

## Capabilities

### Modified Capabilities

- `builtin-tools`: 移除 `tools` 过滤，内置工具恒全注册。
- `agent-loop`: 工具入参规范化（空/非法 → `{}`）。

## Impact

- `packages/core/src/tools/registry.ts`（入参兜底）+ `tools/builtin/index.ts`（移除过滤）+ `agent/loop.ts`（规范化入参）。
- `packages/core/src/agent/assemble.ts`（不再传 `tools` 过滤）。
- `apps/web/src/App.tsx`（默认 `files.roots`）。
- 更新 `builtin-tools.test.ts`（移除过滤用例）、新增入参规范化测试。
- 无 breaking：`tools` 字段保留，语义更新。
