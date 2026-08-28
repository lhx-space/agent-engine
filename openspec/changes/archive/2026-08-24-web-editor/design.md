## Context

给「配置即 Agent」加一个面向人的三栏界面：左边编排 system-prompt，中间配其他项，右边即时试跑。首版目标是「跑通」，UI 精致度（Monaco/Tailwind/shadcn）后置。

## Goals / Non-Goals

**Goals:**

- 三栏布局（CSS Grid）。
- 复用 `@lhx-agent-engine/config` 的 `AgentConfigSchema` + `AgentConfig` 类型（单一事实来源）。
- 左栏编辑 systemPrompt（template + variables）；中栏编辑 model；右栏 input → run → 展示结果。
- Rsbuild dev 代理 `/api` → server。

**Non-Goals:**

- 不引 Monaco / React Hook Form / Tailwind / shadcn / Zustand / React Router / TanStack Query（polish 切片）。
- 不做流式（右栏非流式）。
- 不做完整 config 的全字段表单（首版只 systemPrompt + model，其余字段走后续增量）。

## Decisions

### D1: 三栏 CSS Grid，首版不引 UI 框架

**选择**：原生 CSS Grid（`grid-template-columns` 三列）。

**理由**：首版聚焦「结构与跑通」，不引 Tailwind/shadcn 的构建复杂度；UI 精致度 polish 切片再补。

### D2: 单一事实来源 = config 包

**选择**：WebApp 状态直接是 `AgentConfig`（来自 `@lhx-agent-engine/config`），校验用 `AgentConfigSchema`。

**理由**：与「前端表单校验复用同一份 Zod Schema」一致，不手写第二份类型。

### D3: 右栏直连 server 的 `/api/agent/run`

**选择**：`fetch('/api/agent/run', { method:'POST', body: JSON.stringify({ config, input }) })`，dev 经 rsbuild proxy 转发。

**理由**：WebApp 只做「配置编辑 + 结果展示」，装配执行全在 server。

### D4: dev 代理 `/api` → localhost:8080

**选择**：`rsbuild.config.ts` 的 `server.proxy`。

**理由**：开发期免 CORS，前后端同源。

### D5: config 包拆 `./schema` 子路径（浏览器安全）

**选择**：config 包新增 `./schema` 导出（只含 Zod Schema + 类型，无 jiti/loader）；WebApp 一律 `import from '@lhx-agent-engine/config/schema'`。

**理由**：config 的 `.` 入口会经 loader 带进 `jiti`（Node-only，依赖 `node:module/fs/vm`），浏览器打包直接失败。schema 是浏览器安全的，loader 是 Node 专属；拆子路径让「单一事实来源」真正延伸到前端。

## Risks / Trade-offs

- [首版字段覆盖少] → 中栏只有 model；tools/skills/mcp/rules 等后续增量补（用同一状态结构）。
- [无流式，长回答要等] → 留 `llm-streaming`；首版可接受。
- [config 体积随请求上传] → 本地开发可接受；后续可「server 端 config 注册表 + id」。

## Migration Plan

`apps/web` 现为占位页，直接替换为三栏编辑器，无迁移。
