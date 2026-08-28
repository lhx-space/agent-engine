## Context

find-skill 机制的本质是「发现 → 声明 → 拉取 → 使用」四段。agent-engine 已有后三段（`config.skills` + `resolveSkills` + `plugin-skills` 检索注入），缺「发现」。方案 A 对接 skills.sh（`npx skills` CLI），复用官方生态。

## Goals / Non-Goals

**Goals:**

- otel 进 preset-default 全家桶（opt-in）。
- server 暴露 skill 发现/安装端点，对接 `npx skills`。
- `SkillDiscoverer` 可注入（测试 / 未来换自建 registry）。

**Non-Goals:**

- 不自建 skill registry（方案 B 延后）。
- 不把 find-skill 接进 apps/web 前端（本次只 server 层）。
- 不解析 `npx skills find` 的交互式 TUI（用 `add -l` 非交互列仓库 skills）。

## Decisions

### D1: `npx skills add <repo> -l` 作为「发现」入口

**选择**：discover 调 `npx skills add <owner/repo> -l`（非交互列仓库 skills），strip ANSI 后按 `│    <name>` / `│      <desc>` 解析。

**理由**：`find` 是交互式 TUI 不可子进程调用；`add -l` 已验证非交互输出 skill 列表。粒度是「按 repo 发现」，而非全局 query——够用且稳健。

### D2: `SkillDiscoverer` 可注入

**选择**：`ServerOptions.skillDiscoverer` 可注入，缺省 `createNpxSkillDiscoverer()`；`exec` 也作为 `SkillDiscovererDeps` 可注入。

**理由**：子进程调 npx 是部署层职责（同 provider.ts 读环境变量），可注入便于测试与未来替换自建 registry。

### D3: install 落到 `~/.agents/skills/<skill>`

**选择**：install 调 `npx skills add <repo> -s <skill> --copy -y -g`，返回 `~/.agents/skills/<skill>` 路径，供前端生成 `config.skills` 的 `source: path` ref。

**理由**：复用 skills.sh 的全局安装目录，agent-engine 的 `resolveSkill('path')` 直接可读该目录 SKILL.md，闭环「发现 → 安装 → 声明 → 使用」。

## Risks / Trade-offs

- [解析 TUI 输出脆弱] `parseSkillList` 依赖 `npx skills` 输出格式；若上游格式变化需同步适配（有单测兜底）。
- [npx 依赖网络] discover/install 需网络 + npx 首次下载；server 部署环境需允许出网。
- [createBuiltinPluginFactories 残留] server-api spec 里该函数已删除，本 change 一并移除残留 requirement。

## Migration Plan

- 新增端点/字段，旧 API 零迁移。
- otel opt-in：用户 `config.plugins` 加 `@lhx-agent-engine/plugin-otel` 即可。
