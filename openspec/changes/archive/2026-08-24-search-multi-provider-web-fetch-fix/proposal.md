## Why

当前搜索后端只有 `duckduckgo`（Instant Answer keyless），能力弱（无聚合、结果稀疏、易被限流 abort）；`web_fetch` 仅接受 `text/html`，抓 `raw.githubusercontent.com` 等返回 `text/plain` 的源会直接报「unsupported content-type」，且无 UA / 长度预检，实用性差。需要把搜索做成真正可插拔的多 provider，并修复 web_fetch 的内容类型与抓取健壮性。

## What Changes

- `security.webSearch` 扩展为多 provider：`searxng`（自建 metasearch，默认）/ `duckduckgo`（keyless 兜底）/ `tavily` / `serper`（付费 key）。
- 新增 `webSearch.endpoint`（SearXNG 实例 baseURL）与 `webSearch.apiKey`（tavily/serper）字段。
- 新增 `webSearch.fallback`（默认 `duckduckgo`）：主 provider 缺失必需配置或运行期失败/空结果时，按序回退。
- `web_fetch` 修复：接受 `text/plain` 等 `text/*`（非 HTML 直接返回正文文本）、默认 `User-Agent`、`content-length` 预检拒绝超限响应。

## Capabilities

### Modified Capabilities

- `agent-config-schema`: `webSearch` 子 Schema 扩展 provider 枚举 + `endpoint` / `apiKey` / `fallback`。
- `builtin-tools`: `web_search` 多 provider 解析 + fallback；`web_fetch` 内容类型/UA/长度预检。

## Impact

- 修改 `packages/config/src/schema/index.ts`、`packages/core/src/tools/utils/{http,search,duckduckgo}.ts`。
- 新增 `packages/core/src/tools/utils/{searxng,tavily,serper}.ts`。
- 修改 `packages/core/src/tools/builtin/{index,web-fetch}.ts`。
- 修改 `apps/web/src/config/SecurityForm.tsx`（provider 列表 + endpoint/apiKey/fallback 字段）。
- 更新 `builtin-tools.test.ts`、`schema.test.ts`、`security.test.ts`。
- **Breaking**：`webSearch.provider` 默认由 `duckduckgo` → `searxng`（未配 endpoint 时自动回退 duckduckgo，行为向后兼容）。
