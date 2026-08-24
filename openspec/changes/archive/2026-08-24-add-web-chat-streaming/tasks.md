## 1. 依赖

- [x] 1.1 安装 `@ant-design/x` + `react-markdown` + `remark-gfm` 到 `apps/web`

## 2. 流式消费 lib

- [x] 2.1 `lib/stream-agent.ts`：`StreamEvent` 判别联合类型 + `streamAgent(config, input, onEvent, signal)`（fetch + getReader 按行解析 NDJSON）

## 3. 状态管理 hook

- [x] 3.1 `hooks/use-stream-chat.ts`：消息列表状态机（user/assistant/steps/status）+ buffer + rAF 节流 flush

## 4. chat 面板

- [x] 4.1 `panels/ChatPanel.tsx`：Bubble.List 消息列表 + 输入框 + 步骤时间线（Collapse）
- [x] 4.2 assistant 消息 markdown 渲染（react-markdown + remark-gfm）

## 5. 布局重排

- [x] 5.1 `App.tsx`：左 chat / 中 config / 右 system-prompt
- [x] 5.2 `styles.css` 适配新布局；移除旧 RunPanel

## 6. 验证

- [x] 6.1 web typecheck + build 通过
- [x] 6.2 lint / spell / format 通过
