## Why

server 已经用 `@agent-engine/preset-default` 装配全家桶，但仍缺两环：① `plugin-otel` 刚落地但未进 preset-default，经 `config.plugins` 声明会报「未注册工厂」；②「find-skill」机制缺「发现」入口——用户只能自己知道有哪些 skill 后手写 `config.skills`。本 change 补齐：otel 进全家桶 + server 暴露对接 skills.sh 的 skill 发现端点。

## What Changes

- **preset-default**：`createPresetPluginFactories` 增加 `@agent-engine/plugin-otel` 工厂（opt-in 经 `config.plugins`）。
- **server**：新增 `skill-store.ts`（`createNpxSkillDiscoverer` + `parseSkillList`，经 `npx skills` 对接 skills.sh）；`createApp` 新增 `GET /api/skills/discover` / `GET /api/skills` / `POST /api/skills/install`；`ServerOptions` 新增 `skillDiscoverer` 注入。
- **示例**：新增 `agents/devops-agent.yaml` 作为端到端验证目标（全家桶 + find-skill 的目标 agent）。

## Capabilities

### Added Capabilities

- `server-api`: skill 发现端点（对接 skills.sh）。

### Modified Capabilities

- `preset-default`: 全家桶补 otel。
- `server-api`: 移除已删除的 `createBuiltinPluginFactories` 残留 spec。

## Impact

- 修改 `packages/plugins/preset-default/{package.json,src/index.ts}`。
- 修改 `packages/server/src/{app.ts,types.ts,index.ts,skill-store.ts}`、`tests/{skill-store,skill-api}.test.ts`。
- 新增 `agents/devops-agent.yaml`。
- 兼容性：新增端点与注入字段，旧 API 不变。
