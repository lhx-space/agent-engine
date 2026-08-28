# 贡献指南

感谢你想为 Agent Engine 做贡献！本文档说明如何搭建环境、提交代码、跑测试。

## 开发环境

- Node.js ≥ 22（见 `.nvmrc`）
- pnpm ≥ 10（`corepack enable` 或 `npm i -g pnpm`）

````bash
pnpm install
```text

## 常用命令

```bash
pnpm build          # 构建所有 packages
pnpm lint           # rslint
pnpm typecheck      # tsc --noEmit 全仓
pnpm spell          # cspell
pnpm test           # rstest
pnpm web:dev        # apps/web 开发
pnpm docs:dev       # Rspress 文档站
```text

## 分支与提交

- `main` 始终可发布，禁止直接 push，只经 PR 合并。
- 功能分支 `feat/<scope>-<简述>`，修复分支 `fix/<issue>-<简述>`。
- 提交遵循 Conventional Commits：

```text
feat(core): 新增模型路由
fix(plugin-mcp): 远程 MCP 连接失败时正确释放资源
docs: 同步架构规划
```text

## 开发流程（OpenSpec）

本项目遵循 OpenSpec 规格驱动开发。功能开发先写 proposal + spec，再写代码：

1. `/opsx:propose` 写变更提案与规格。
2. `/opsx:apply` 按规格实现。
3. `/opsx:archive` 归档。

详见 `openspec/`。

## 目录约定（一个 agent = 一个目录）

```text
.lhx-agent/<name>/
├── context/system.md       # frontmatter 标量 + systemPrompt
├── context/knowledge/*.md  # documents 知识源
├── rules/*.mdc             # 每条规则一个文件
├── skills/<skill>/SKILL.md # 每个 skill 一个目录
├── hooks/*.ts              # 每个 hook 一个文件
└── mcps/*.yaml             # 每个 MCP server 一个文件
```text

## 提交前自检

- [ ] `pnpm lint` / `typecheck` / `spell` / `test` 全绿
- [ ] 更新了相关文档（README / AGENTS.md / 包 README）
- [ ] 新增能力有对应测试
````
