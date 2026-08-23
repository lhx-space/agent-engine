## Context

5.5 统一检索已用 rules 落地。skills 是第二个接入，差异加载 = 指令注入 + 捆绑工具注册。config 的 `skills: [{ path }]` 引用 SKILL.md，需从路径加载成 Skill 对象后进入检索与加载链路。

## Goals / Non-Goals

**Goals:**

- `Skill` 类型 + `SkillLoader`（复用 `CapabilityRegistry` BM25 检索）。
- `loadSkillFromPath` 从 SKILL.md 加载（gray-matter 解析 frontmatter）。
- `buildSystemPrompt` 增加 `{{skills}}` 注入；AgentLoop 集成（指令注入 + 工具注册）。

**Non-Goals:**

- skills 的 `always` 加载策略（config 的 `SkillRef` 无 kind，首版全 on-demand）。
- 捆绑工具从文件声明加载（首版 `tools` 仅编程式传入，文件内工具声明留后续）。
- skill 的版本 / 依赖 / 冲突管理。

## Decisions

### D1: skills 复用 CapabilityRegistry，type='skill'

**选择**：`SkillLoader` 把 skills 注册进统一 `CapabilityRegistry`（`type='skill'`），BM25 检索与 rules 共用。

**理由**：5.5 的核心是「检索层统一，加载层按 type 分派」；skill 复用同一检索，只在加载时按 skill 语义（注入指令 + 注册工具）分派。不重复造检索器。

### D2: skills 首版全 on-demand

**选择**：`SkillLoader.loadForQuery` 全部经 BM25 召回（无 always 分支）。

**理由**：`AgentConfig.skills` 的 `SkillRef` 只有 `path`，无 kind 字段；且 skill 的典型用法就是「任务相关才加载」。always 后续按需加 kind。

### D3: SKILL.md 用 gray-matter 解析

**选择**：`loadSkillFromPath` 用 `gray-matter` 解析 SKILL.md 的 frontmatter（name/description）与正文（instruction）。

**理由**：frontmatter 解析是成熟需求，gray-matter 是标准库，符合「复用优先」；手写正则属重复造轮子。

**备选**：手写 `---` 提取 + yaml.parse。缺点：边界（CRLF、无 frontmatter、多段 ---）易漏。**否决**。

### D4: buildSystemPrompt 增加 {{skills}} 内置变量

**选择**：`buildSystemPrompt` 新增 `skills` 参数（命中 skills 指令拼接文本），作为内置变量 `{{skills}}` 注入；模板未声明时兜底追加。与 `{{rules}}` 同构。

**理由**：保持组装 API 统一（`rules` / `skills` 都是「检索结果文本」），模板显式控制注入位置 + 兜底。

### D5: AgentLoop 集成——指令注入 + 工具注册

**选择**：`AgentLoopOptions.skills?: Skill[]`；run 时 `SkillLoader.loadForQuery` 检索命中 skills，指令交给 `buildSystemPrompt` 注入，捆绑工具 `registry.register` 注册（同名覆盖，重复注册无害）。

**理由**：与 rules 集成对称（规则文本 / 技能指令都进 system prompt），skill 额外把工具并入注册表，体现「差异加载」。

## Risks / Trade-offs

- [工具注册时机] → run 时注册到共享 ToolRegistry，多次 run 重复注册（同名覆盖，幂等）；并发场景需后续加「装配锁」。
- [skills 检索无 always] → 需常驻的 skill 目前无法强制加载，后续加 kind 解决。
- [gray-matter 新依赖] → 轻量、零运行时依赖（纯解析），风险低。

## Migration Plan

无迁移：skills 为可选增量；`SkillRef`（config）后续由装配层调 `loadSkillFromPath` 消费。
