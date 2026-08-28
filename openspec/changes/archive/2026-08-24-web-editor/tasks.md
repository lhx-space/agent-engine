## 1. 依赖与代理

- [x] 1.1 `apps/web` 新增依赖 `@lhx-agent-engine/config`（workspace:*）
- [x] 1.2 `rsbuild.config.ts` 加 `server.proxy` `/api` → localhost:8080
- [x] 1.3 config 包新增 `./schema` 子路径导出（浏览器安全，隔离 Node-only loader）

## 2. 布局与状态

- [x] 2.1 `App.tsx`：三栏 CSS Grid + `AgentConfig` 状态
- [x] 2.2 `styles.css`：三栏布局样式

## 3. 面板

- [x] 3.1 `panels/SystemPromptPanel.tsx`：template + variables 键值对
- [x] 3.2 `panels/ConfigPanel.tsx`：model（provider/baseURL/model/temperature/maxTokens）
- [x] 3.3 `panels/RunPanel.tsx`：input + run + 结果/错误展示
- [x] 3.4 `lib/run-agent.ts`：fetch 封装

## 4. 验证

- [x] 4.1 `pnpm --filter @lhx-agent-engine/web build` 通过 + typecheck
