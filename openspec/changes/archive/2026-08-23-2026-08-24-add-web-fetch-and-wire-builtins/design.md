## Context

承接 `add-builtin-tools`：内置工具与 sandbox 已实现但未接进主流程，且 web 能力缺 `web_fetch` 原语。本 change 收口这两点，使「配置即 Agent」真正可跑。

## Goals / Non-Goals

**Goals:**

- 新增 `web_fetch` 通用内置工具（与 `web_search` 互补）。
- `registerBuiltinTools` 支持按配置 `tools` 引用过滤。
- `assembleAgentLoop` 接进内置工具（最小接线）。

**Non-Goals:**

- 不实现完整 `AgentConfig → AgentLoop` resolve 层（skills 按路径加载 / plugin 按名安装 / mcp client / 引用解析）——仍留 M3。
- 不接入真实搜索引擎（web_search 仍用可配置 endpoint）。

## Decisions

### D1: `web_fetch` 与 `web_search` 分离

**选择**：`web_search`（query → 搜索 endpoint）与 `web_fetch`（url → 页面文本）两个独立原语。

**理由**：输入/语义不同（搜索 vs 抓取），各自独立更清晰；都复用同一套 domain/超时/截断策略。

### D2: 共享 `WebPolicySchema` + `extend`

**选择**：`WebPolicySchema`（allowDomains / denyDomains / timeoutMs / maxOutputBytes）为共享基类；`WebSearchPolicySchema = WebPolicySchema.extend({ endpoint })`；`security.webFetch` 直接用 `WebPolicySchema`。

**理由**：避免 web_search / web_fetch 两套重复的 domain/超时/截断字段；`endpoint` 仅搜索需要。

### D3: `isDomainAllowed` 收敛为结构型 `DomainPolicy`

**选择**：`isDomainAllowed(policy: { allowDomains: string[]; denyDomains: string[] }, url)`。

**理由**：web_search 与 web_fetch 的策略都含这两个字段，结构型签名让两者复用同一校验函数。

### D4: `todo` 恒注册

**选择**：`todo` 作为规划原语（AGENTS.md 6.2），`registerBuiltinTools` 始终注册，不受 `tools` 过滤影响。

**理由**：任务规划是通用能力，应默认可用；其余工具按配置声明。

### D5: `deps.tools` 过滤 + `assembleAgentLoop` 接线

**选择**：`registerBuiltinTools` 增 `deps.tools?: ToolRef[]`（匹配 `builtin.<name>`，空/缺省 = 全部）；`assembleAgentLoop` 增 `security` / `tools` / `sandbox` 选项，传 `security` 即装配内置工具。

**理由**：最小接线——把「配置声明的内置工具」接到装配层；完整 resolve（含 mcp/skills/plugins 引用解析）仍 M3。

## Risks / Trade-offs

- [共享默认对象可变] → `DEFAULT_WEB_FETCH` 等为模块级对象，与既有 `.default([])` 约定一致，可接受。
- [tools 过滤与 todo 恒注册的语义] → 文档明确：todo 始终可用，其余按 `tools` 引用。
- [web_fetch 无内容解析] → 首版返回原始文本，HTML→markdown 解析留后续（可换库或 skill）。

## Migration Plan

无迁移。新增字段/选项，旧配置缺省即「无 web_fetch + 无内置工具装配」，向后兼容。
