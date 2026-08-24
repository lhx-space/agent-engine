## Context

前端已能可视化编辑 AgentConfig 并在线运行，但缺「导出配置」能力。目标是让用户把当前配置保存为 YAML / JSON 文件，落地到仓库 `agents/` 或本地热挂载目录。

## Goals / Non-Goals

**Goals:**

- 一键导出 YAML / JSON，触发浏览器下载。
- 复用 `yaml` 包（与 config 包同生态）做 YAML 序列化。

**Non-Goals:**

- 不做导入（从文件加载回表单）——本次只导出。
- 不做服务端保存 / 版本管理。

## Decisions

### D1: 导出在前端做（浏览器 Blob 下载），不走 server

**选择**：前端直接 `JSON.stringify` / `yaml.stringify` + `Blob` + `<a download>` 触发下载。

**理由**：配置本来就完整地存在于前端 state（复用 Zod Schema），无需回 server 再拿；导出是纯客户端操作，简单直接，且 YAML 序列化是纯 JS。

### D2: YAML 用 `yaml` 包 stringify，JSON 用原生 JSON.stringify

**选择**：格式下拉（YAML 默认 / JSON），分别用 `yaml.stringify(config)` 与 `JSON.stringify(config, null, 2)`。

**理由**：复用优先；`yaml` 与 config 包同源（`parse`），`stringify` 对称，产物可直接被 `loadAgentConfig` 读回。

### D3: 文件名用 config.name + 格式后缀

**选择**：`<name>.yaml` / `<name>.json`，`name` 非法字符做降级。

**理由**：直观、可追溯。

## Risks / Trade-offs

- [apiKey 随导出文件落盘] → 导出会包含 `model.apiKey`；默认保留（用户要完整配置），后续可加「导出时脱敏」开关。
- [YAML 序列化 undefined 字段] → `yaml.stringify` 对 undefined 字段输出空值，行为与 JSON 略不同；可接受。

## Migration Plan

无破坏，纯新增按钮。
