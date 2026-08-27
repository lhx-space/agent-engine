## ADDED Requirements

### Requirement: skill 发现端点

系统 SHALL 提供 `GET /api/skills/discover?repo=<owner/repo>`（列出 skills.sh 某仓库的 skills）、`GET /api/skills`（列出已装 skills）与 `POST /api/skills/install`（`{ repo, skill }` 安装并返回本地路径）；`options.skillDiscoverer` SHALL 可注入 `SkillDiscoverer`（缺省 `createNpxSkillDiscoverer()`，经 `npx skills` 对接 skills.sh）。

#### Scenario: 发现 skill 列表

- **WHEN** `GET /api/skills/discover?repo=vercel-labs/agent-skills`
- **THEN** 返回 `{ repo, skills: [{ name, description }] }`

#### Scenario: 安装 skill

- **WHEN** `POST /api/skills/install` 传 `{ repo, skill }`
- **THEN** 返回 `{ path }`（本地安装路径）

#### Scenario: 缺参数返回 400

- **WHEN** discover 缺 `repo`，或 install 缺 `repo` / `skill`
- **THEN** 返回 400

## REMOVED Requirements

### Requirement: 内置 plugin 工厂注入

## MODIFIED Requirements

### Requirement: HTTP API 应用

系统 SHALL 提供 `createApp(options)`，返回一个 Hono 实例，含 `GET /health`、`POST /api/agent/run`、`POST /api/agent/run/stream`、`DELETE /api/agent/sessions/:id` 与 skill 发现端点（`GET /api/skills/discover` / `GET /api/skills` / `POST /api/skills/install`）；`options` 可注入 `pluginFactories`、`providerFactory`、`sessionStore`、`logger` 与 `skillDiscoverer`。

#### Scenario: 创建应用

- **WHEN** 调用 `createApp()`（不传 options）
- **THEN** 返回可用的 Hono 实例，`GET /health` 返回 `{ ok: true }`
