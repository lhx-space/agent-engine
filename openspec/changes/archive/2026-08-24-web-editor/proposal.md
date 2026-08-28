## Why

「配置即 Agent」在 core 层已闭合、server 已提供 `/api/agent/run`，但还没有一个面向人的界面来「编排配置 + 即时试跑」。这是单 Agent 在实际应用中校验的最后一块：WebApp 三栏编辑器（左 system-prompt、中其他配置、右测试 agent），前端直接调刚建好的 server。

## What Changes

- 新增 `apps/web` 的三栏编辑器（React 19 + Rsbuild，复用 `@lhx-agent-engine/config` 作为单一事实来源）：
  - 左栏：`systemPrompt.template` + `variables`（键值对）。
  - 中栏：`model`（provider / baseURL / model / temperature / maxTokens）。
  - 右栏：input → 调 `POST /api/agent/run` → 展示 `finalMessage.content` + `steps` + 错误。
- Rsbuild dev 代理 `/api` → `http://localhost:8080`（server）。

## Capabilities

### New Capabilities

- `web-editor`: 三栏布局、systemPrompt 编辑、model 配置、测试 agent、dev 代理。

## Impact

- 修改 `apps/web/`（`App.tsx`、`panels/*`、`lib/run-agent.ts`、`styles.css`、`rsbuild.config.ts`）。
- `apps/web` 新增依赖 `@lhx-agent-engine/config`（workspace，复用 Schema + 类型）。
- config 包新增 `./schema` 子路径导出（浏览器安全，隔离 Node-only 的 loader/jiti）。
- 无新增三方 UI 库（首版用原生 CSS/表单，Monaco / Tailwind / shadcn / React Hook Form 留 polish 切片）。
- 无 breaking changes：`apps/web` 现为占位页，直接替换。

## 非目标（首版不做）

- Monaco 编辑器、React Hook Form、Tailwind/shadcn、Zustand、React Router、TanStack Query —— 留后续 polish 切片。
- 流式展示（右栏先非流式，流式留 `llm-streaming`）。
- 多 Agent 拓扑可视化（React Flow）。
