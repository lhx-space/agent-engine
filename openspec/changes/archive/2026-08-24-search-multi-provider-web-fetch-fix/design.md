## Context

`web_search` 目前仅支持 `duckduckgo` Instant Answer（keyless JSON），返回稀疏、易限流；`web_fetch` 只认 `text/html` 且无 UA，抓取 GitHub raw（`text/plain`）等常见源直接失败。对标 Claude Code / OpenHands 的做法：搜索后端可插拔（自建 SearXNG 聚合 + 商业 Tavily/Serper + keyless 兜底），web_fetch 对文本类内容类型宽容处理并带 UA 与长度预检。

## Goals / Non-Goals

**Goals:**

- 搜索多 provider：`searxng`（默认，自建）/ `duckduckgo`（keyless 兜底）/ `tavily` / `serper`（key）。
- `webSearch.endpoint`（searxng baseURL）+ `apiKey`（tavily/serper）+ `fallback`（默认 duckduckgo）字段。
- 主 provider 缺配置或失败时按序回退，最终无可用则抛可读错误。
- `web_fetch` 接受 `text/*`（非 HTML 直接返回文本）、默认 UA、`content-length` 预检。

**Non-Goals:**

- 不做 embedding/语义检索、不做结果重排/缓存（M3）。
- 不做搜索结果的「按需启用」开关（tools 轴 P2）。
- 不做 web_fetch 的 JS 渲染 / 分页抓取。

## Decisions

### D1: `FetchLike` 扩展为支持 method/headers/body + 响应头

**选择**：`FetchInit` 增加 `method` / `headers` / `body`（向后兼容，原 `{ signal }` 调用不变）；`HttpResponse` 增加 `headers?: Record<string,string>`（小写 key）供 `content-length` 预检；`defaultFetch` 透传并缺省补 `User-Agent`。

**理由**：Tavily/Serper 是 POST + `Authorization` header，必须扩展 fetch 抽象；UA 缺省在 `defaultFetch` 统一补，避免每个 provider 各自拼。`FetchLike` 是注入边界，扩展不破坏现有调用。

### D2: provider 解析 + 回退在 `resolveSearchProvider` 统一

**选择**：`resolveSearchProvider(security, deps)` 按 `[provider, fallback]` 顺序构造候选链；`searxng` 缺 `endpoint`、`tavily`/`serper` 缺 `apiKey` 时**跳过该候选**（视为不可用），不尝试网络；剩余候选用 `createFallbackSearchProvider` 组合——逐个 `search()`，抛错或空结果则试下一个，全失败抛最后一个错误。

**理由**：缺配置在 resolve 期跳过，避免每次搜索都先失败一次（默认 searxng 无 endpoint 时直接落到 duckduckgo，向后兼容）。fallback 是「能力降级」而非「重试」，语义清晰。

### D3: SearXNG 默认、duckduckgo 兜底

**选择**：`provider` 默认 `searxng`、`fallback` 默认 `duckduckgo`。SearXNG 的 JSON API `GET /search?q=..&format=json` 返回 `results[]`（`title`/`url`/`content`/`engine`/`score`），归一化为 `SearchResult`（`content` → `snippet`）。

**理由**：SearXNG 聚合多引擎、可自建、无 key、无单点限流，是生产默认；duckduckgo keyless 作为零配置兜底。用户本地有 Docker，`docker run -p 8080:8080 searxng/searxng` 即可。

### D4: web_fetch 内容类型放宽 + UA + 长度预检

**选择**：`text/html`（含 `application/xhtml+xml`）走 Readability 提取；其余 `text/*` 直接 `response.text()` 作为正文（title 取 URL）；`content-length` 头存在且超过 `maxOutputBytes * 20` 时抛错（HTML 正文占比通常 <5%，20x 覆盖标记开销）；`defaultFetch` 缺省 `User-Agent: agent-engine/0.1`。

**理由**：`text/plain` 是 GitHub raw、README、日志等常见源，非 HTML 无需提取直接返回；20x 是「原始 HTML vs 提取正文」的经验倍数，超限即大概率是超大二进制/超大页，应提前拒绝而非下载后截断。

## Risks / Trade-offs

- [默认 provider 变更] → 默认 `searxng` 无 endpoint 时自动落 duckduckgo，行为与旧默认一致；前端预设同步。
- [content-length 20x 是启发式] → 对「原始 HTML 巨大但正文极小」的页可能误拒；可接受，因正文 > maxOutputBytes 时本就截断，边界收益有限。
- [tavily/serper 需 key] → 未配 `apiKey` 时该候选被跳过并回退；不读环境变量（与「core 只读 model.apiKey」约定一致，key 经配置 `${VAR}` 插值或 server 层注入）。

## Migration Plan

- 旧配置 `webSearch.provider: duckduckgo` 仍合法（显式指定即可）；不写 provider 的配置默认 searxng→无 endpoint→回退 duckduckgo，行为不变。
- 自建 SearXNG：`docker run -p 8080:8080 searxng/searxng`，配置 `webSearch.endpoint: http://localhost:8080`。
- 前端 SecurityForm 增加 endpoint / apiKey / fallback 字段与 provider 枚举。
