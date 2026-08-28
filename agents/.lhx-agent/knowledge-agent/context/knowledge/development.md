# 开发规范

> 本文档约束所有后端 / 前端 / Agent 配置的日常开发。提交代码前必须逐条自查，不达标的提交会被 CI 拦截或评审打回。

## 目录

1. 代码规范
2. TypeScript 严格约定
3. 测试规范
4. 分支与提交规范
5. 代码审查清单
6. CI / CD 流水线

## 一、代码规范

### 1.1 通用约定

- 类型严格：`strict` 开启，禁止 `any`；确需宽类型时用 `unknown` + 收窄。
- 命名：变量/函数 `camelCase`，类型/接口 `PascalCase`，常量 `UPPER_SNAKE_CASE`。
- 函数单一职责：一个函数只做一件事，超过 50 行需拆解。
- 注释写「为什么」，不写「是什么」（代码本身能表达「是什么」）。

### 1.2 依赖方向（硬约束）

````text
config ← core ← cli / server ← plugins
```text

- 禁止反向依赖、禁止循环依赖。
- 能力一律外置为插件，内核只承载引擎 + 协议。

### 1.3 错误处理

- 对外 API 的错误必须可读，抛错带上下文（`new Error(msg, { cause })`）。
- 不吞异常：捕获后要么处理、要么向上抛，禁止空 `catch {}`。

### 1.4 日志

- 结构化日志，必带 `trace_id` / `service` / `level`。
- 分级规范见《监控告警规范》文档。

## 二、TypeScript 严格约定

### 2.1 类型定义

- 配置 Schema 一律用 Zod 定义，类型经 `z.infer` 衍生，禁止手写重复类型。
- 对外 API 显式导出类型（`export type { ... }`），不依赖隐式推断。

### 2.2 常见陷阱

- `z.object({...}).default({})` 不会级联内层默认值，需显式给全量默认。
- 对象字面量 `{ __proto__: x }` 是「设原型」不是「设属性」，测试带危险 key 的对象用 `JSON.parse` 构造。
- 函数参数逆变：放宽参数类型时注意 `strictFunctionTypes`。

## 三、测试规范

### 3.1 测试分层

| 层 | 工具 | 覆盖目标 |
| --- | --- | --- |
| 单元测试 | rstest | 纯函数、工具类、协议实现 |
| 集成测试 | rstest | 插件装配、agent 端到端 |

### 3.2 覆盖率要求

- 核心内核（loop / 装配 / 协议）：关键路径必须有单测。
- 新插件：至少覆盖「正常路径 + 一个失败路径」。
- 不追求 100% 覆盖率，但「改了会炸」的路径必须有测试。

### 3.3 测试命名

- 描述行为而非实现：`should 首次调用写缓存` 优于 `test caching 1`。

## 四、分支与提交规范

### 4.1 分支策略

- `main`：始终可发布，禁止直接 push，只经 PR 合并。
- 功能分支：`feat/<scope>-<简述>`（如 `feat/plugin-pgvector`）。
- 修复分支：`fix/<issue>-<简述>`。

### 4.2 提交信息（Conventional Commits）

```text
feat(core): 新增模型路由（复杂度 + 能力标签切换）
fix(plugin-mcp): 远程 MCP 连接失败时正确释放资源
refactor(server): 三层架构（routes → handlers → services）
docs: 同步架构规划与引擎缺口
```text

- 类型：`feat` / `fix` / `refactor` / `docs` / `chore` / `test` / `perf`。
- subject 小写开头，简洁描述「做了什么」。

### 4.3 提交前检查

```bash
pnpm lint          # rslint
pnpm typecheck     # tsc --noEmit（全仓）
pnpm spell         # cspell
pnpm test          # rstest
```text

四项全绿才能提交（husky + lint-staged 会强制拦截）。

## 五、代码审查清单

审查他人 PR 时，逐条过：

1. **正确性**：边界条件、空值、并发竞态、错误处理是否闭环。
2. **安全**：注入风险、敏感信息硬编码、越权、依赖漏洞。
3. **性能**：N+1 查询、不必要的深拷贝、阻塞主线程、无界循环。
4. **可维护性**：命名、单一职责、重复逻辑、测试覆盖、类型严格。
5. **契约**：对外 API 是否显式导出类型、错误是否可读。

审查结论按 `blocker / major / minor` 分级，blocker 必须修复才能合并。

## 六、CI / CD 流水线

### 6.1 流水线阶段

```text
push → install → lint → typecheck → spell → test → build → (main) 打镜像 → 灰度发布
```text

### 6.2 门禁

- lint / typecheck / spell / test 任一失败 → 流水线失败，禁止合并。
- `main` 分支构建产物打 `latest` 与 `git-sha` 两个 tag。

### 6.3 一个 Agent 的目录约定

```text
.lhx-agent/<name>/
├── context/system.md       # frontmatter 标量 + systemPrompt 正文
├── context/knowledge/*.md  # 知识源（documents）
├── rules/*.mdc             # 每条规则一个文件
├── skills/<skill>/SKILL.md # 每个 skill 一个目录
├── hooks/*.ts              # 每个 hook 一个文件
└── mcps/*.yaml             # 每个 MCP server 一个文件
```text
````
