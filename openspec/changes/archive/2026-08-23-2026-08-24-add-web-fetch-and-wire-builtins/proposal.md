## Why

上一 change 落地了 sandbox + 内置工具，但两处收口未做完：

1. **内置工具是「孤岛」**：`registerBuiltinTools` 存在却未接进 `assembleAgentLoop`，`tools: [{use: builtin.bash}]` 不会真的注册工具，demo 仍靠 mock。
2. **web 能力缺 `web_fetch` 原语**：现有 `web_search`（query → 搜索 endpoint）之外，还缺「fetch 任意 URL 取文本」的通用原语，两者互补。

## What Changes

- 新增 `web_fetch` 内置工具：`fetch` 任意 URL 取文本/markdown，domain 白/黑名单 + 超时 + 截断（复用 `isDomainAllowed`）。
- config 新增 `security.webFetch` 策略；抽出共享 `WebPolicySchema`（allowDomains / denyDomains / timeoutMs / maxOutputBytes），`webSearch` 在其上 `extend` 出 `endpoint`。
- `registerBuiltinTools` 支持 `deps.tools`（`ToolRef[]`）过滤：只注册配置声明的内置工具（`todo` 作为规划原语恒注册）。
- **接线主流程**：`assembleAgentLoop` 新增 `security` / `tools` / `sandbox` 选项，传入 `security` 时调用 `registerBuiltinTools` 完成内置工具装配。

## Capabilities

### Modified Capabilities

- `builtin-tools`: 新增 `web_fetch` requirement；`registerBuiltinTools` 装配新增 web_fetch + `tools` 过滤 + todo 恒注册。
- `agent-config-schema`: `security` 新增 `webFetch`；抽出共享 `web 策略`（`WebPolicySchema`）。
- `plugins`: `assembleAgentLoop` 装配新增内置工具接线（`security` / `tools` / `sandbox`）。

## Impact

- 新增 `packages/core/src/tools/builtin/web-fetch.ts`；重构 `web-search.ts`（`isDomainAllowed` 收敛为结构型 `DomainPolicy`）。
- 扩展 `packages/config/src/schema/index.ts`（`WebPolicySchema` + `security.webFetch`）。
- 修改 `packages/core/src/tools/builtin/index.ts`（web_fetch + tools 过滤）、`packages/core/src/agent/assemble.ts`（接线）。
- 更新 `demo.test.ts` 用真实内置工具（read_file/todo/web_search/web_fetch）。
- 无 breaking changes（新增字段/选项，`security` 缺省仍向后兼容）。
