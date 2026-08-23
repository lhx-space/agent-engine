## Why

内置 `bash` 工具本质是「把任意命令执行交给一个不可完全信任的模型」：模型会读文件/网页，存在 prompt injection 诱导执行破坏性命令的风险。只靠 rules/system-prompt 是软约束，模型可能忽略；必须有**不依赖模型自觉的硬边界**——OS 级执行隔离（沙箱）。

同时本项目纪律是「复用优先，拒绝重复造轮子」：沙箱不该自己写，而应复用成熟的系统级方案（Docker 容器 / nsjail）。本 change 引入 `SandboxBackend` 可插拔抽象 + 两个后端（docker + nsjail），并落地「沙箱不可用即禁用」的安全默认。

## What Changes

- 定义 `SandboxBackend` 接口与 `SandboxExecRequest` / `SandboxExecResult` 类型。
- 实现 **Docker 后端**（`createDockerSandbox`）与 **nsjail 后端**（`createNsJailSandbox`，Linux）。
- 实现**后端选择工厂**：`auto` 探测 docker / nsjail 可用性，不可用时返回不可用（供上层禁用 bash）。
- 实现**资源限制 + 输出截断**：`timeoutMs` / `maxOutputBytes` / cpu / memory / pids。
- 实现**网络隔离**：默认 `network: none`，`allowNetwork` 显式开启。
- 在 `config` 包新增 `security` 配置段（`sandbox` / `bash` / `files` / `webSearch` 子 Schema），并入 `AgentConfig`。

## Capabilities

### New Capabilities

- `execution-sandbox`: `SandboxBackend` 接口、docker / nsjail 双后端、后端选择工厂、资源限制与输出截断、网络隔离、沙箱不可用即禁用。

### Modified Capabilities

- `agent-config-schema`: `AgentConfig` 顶层新增 `security` 字段；新增 `security 配置` requirement（sandbox / bash / files / webSearch 子 Schema 与默认值）。

## Impact

- 新增 `packages/core/src/sandbox/`（types / docker / nsjail / index + 工厂）。
- 扩展 `packages/config/src/schema/index.ts`（`security` 段 + 子 Schema），`AgentConfigSchema` 新增 `security: SecurityConfigSchema.optional()`。
- **无新增三方依赖**：通过 `node:child_process` 驱动系统二进制 `docker` / `nsjail`（复用优先）。
- 新增 `packages/core/tests/sandbox.test.ts`（argv 构建 / 工厂探测）+ 扩展 config schema 测试。
- 无 breaking changes：`security` 为可选字段，缺省时向后兼容（bash 禁用）。
