## Why

1. **职责不清**：`builtin/` 里混入了大量非 tool 的支撑代码（`FetchLike`/`HttpResponse`、`SearchProvider`、DuckDuckGo 后端、`TodoStore`、`checkBashPolicy`、`resolveWithinRoot`、`isDomainAllowed`、`extractContent`），应下沉到 `tools/utils/`。
2. **缺通用工具**：calculator / datetime / json / base64 / sitesearch 是无副作用、真通用的原语，应内置。

## What Changes

- **utils 拆分**：`packages/core/src/tools/utils/` 收纳非 tool 支撑（http / search / path / domain / html / todo-store / bash-policy）。
- **新增 5 个内置工具**：
  - `calculator`（`expr-eval` 安全求值，禁 eval）
  - `datetime`（Node 原生 Date/Intl，零依赖）
  - `json`（parse / stringify，JSON.parse/stringify，零依赖）
  - `base64`（encode / decode，Node Buffer，零依赖）
  - `sitesearch`（复用 SearchProvider，加 `site` 过滤）
- `SearchProvider.search` 增 `site` 可选过滤；DuckDuckGo 用 `site:` 语法。

## Capabilities

### New Capabilities

- `builtin-tools` 新增 5 个 requirement：calculator / datetime / json / base64 / sitesearch。

### Modified Capabilities

- `builtin-tools`: `内置工具统一装配` 注册新工具。

## Impact

- 新增 `packages/core/src/tools/utils/`（7 文件）；`builtin/` 移出非 tool 代码。
- 新增 `builtin/{calculator,datetime,json,base64,sitesearch}.ts`。
- **新增依赖**：`expr-eval`（core，安全表达式解析）。
- 更新 `builtin/index.ts`（registerBuiltinTools 注册新工具）、`types.ts`、`index.ts`、测试。
- 无 breaking（纯新增 + 内部文件移动，导出路径经 `builtin/index.ts` 保持稳定）。
