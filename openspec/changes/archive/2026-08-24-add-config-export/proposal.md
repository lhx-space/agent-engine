## Why

用户在前端配置好 Agent 后，无法把配置导出为 YAML / JSON 文件。「配置即 Agent」的闭环里，可视化编辑只是入口，导出配置文件是「配置落地到仓库 / 热挂载」的关键一步。当前前端只能在线运行，配置无法离线保存、复用、版本化。

## What Changes

- 前端新增「导出配置」按钮：把当前 `AgentConfig` 导出为 YAML 或 JSON 文件并触发浏览器下载。
- YAML 序列化复用 `yaml` 包的 `stringify`（与 config 包同一生态，纯 JS 可进浏览器）。

## Capabilities

### New Capabilities

- `web-editor`: 配置导出（YAML / JSON）。

## Impact

- 新增 `apps/web/src/lib/export-config.ts`（导出逻辑）。
- 扩展 `apps/web/src/App.tsx`（导出按钮 + 下拉选择格式）。
- 依赖新增 `yaml` 到 `apps/web`。
- 无后端改动、无 breaking。
