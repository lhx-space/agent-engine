## Context

`builtin/` 职责不清：既放工具工厂，又放 http 抽象、搜索后端、store、policy、路径/domain/html 辅助。本 change 下沉非 tool 支撑到 `tools/utils/`，并补齐 5 个通用内置工具。

## Goals / Non-Goals

**Goals:**

- utils 拆分：`builtin/` 只留纯工具工厂 + 装配；支撑代码进 `tools/utils/`。
- 新增 calculator / datetime / json / base64 / sitesearch。

**Non-Goals:**

- git 工具套件——做成 plugin（下一 change）。
- schema 校验（ajv）——json 工具首版仅 parse/stringify。

## Decisions

### D1: utils 目录结构

**选择**：`tools/utils/` 收纳 `http.ts`（FetchLike/HttpResponse/defaultFetch）、`search.ts`（SearchProvider/SearchResult/DuckDuckGo）、`path.ts`（resolveWithinRoot）、`domain.ts`（DomainPolicy/isDomainAllowed）、`html.ts`（extractContent）、`todo-store.ts`（TodoStore）、`bash-policy.ts`（checkBashPolicy）。

**理由**：非 tool 支撑与 tool 工厂职责分离；`builtin/` 只暴露 create*Tool + 装配。

### D2: calculator 用 `expr-eval`

**选择**：`expr-eval`（递归下降解析器）求值，禁用 `eval`/`Function`。

**理由**：安全、轻量；「复用优先」，不自己写表达式解析器。

### D3: datetime / json / base64 零依赖

**选择**：datetime 用 `Date` + `Intl.DateTimeFormat`；json 用 `JSON.parse/stringify`；base64 用 `Buffer`。

**理由**：Node 内置即可，不引依赖。

### D4: sitesearch 复用 SearchProvider + `site` 过滤

**选择**：`SearchProvider.search(query, { site })` 增 `site` 可选；DuckDuckGo 拼 `query site:site`；`createSiteSearchTool(provider, policy)` 入参 `{ query, site }`。

**理由**：站内搜索是「搜索 + 站点过滤」的参数化，复用后端而非另造。

### D5: 新工具均按 `deps.tools` 过滤（todo 除外）

**选择**：calculator/datetime/json/base64/sitesearch 与 read/write/web 一样受 `want()` 过滤；仅 todo 恒注册。

**理由**：配置声明「有哪些工具」，一致性。

## Risks / Trade-offs

- [expr-eval 无符号计算/变量] → 首版仅数值表达式，变量/单位留后续。
- [datetime 时区语义] → 首版 `now`/`format`/`parse`，时区换算留后续。

## Migration Plan

无迁移。文件移动后 `builtin/index.ts` 仍统一 re-export，外部导入路径稳定。
