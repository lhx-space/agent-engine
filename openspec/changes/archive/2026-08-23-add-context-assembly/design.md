## Context

AGENTS.md 5.4 定义 system-prompt 由「模板 + 变量 + 各模块（skills/rules/plugins）注入的片段」组装而成；5.5 定义 rules 按需检索（`RuleLoader.loadForQuery`）。上一 change 已落地检索层，但 `AgentLoop` 仍接收静态 `systemPrompt` 字符串，检索结果无处注入——本 change 打通「模板渲染 + rules 注入」这一环。

## Goals / Non-Goals

**Goals:**

- 实现 `renderTemplate`：`{{var}}` → 变量值；未提供变量保留原样，null/undefined 替换为空串。
- 实现 `buildSystemPrompt(query, options)`：渲染用户变量 + 内置 `rules` 变量（`ruleLoader.loadForQuery(query)` 结果），模板未声明 `{{rules}}` 时兜底追加规则文本。
- AgentLoop 的 `systemPrompt` 支持函数式（同步/异步），每次 `run` 动态解析。

**Non-Goals:**

- 不做 skills / plugins 的 prompt 片段注入（本 change 只覆盖 rules，其余按 5.5 后续推广）。
- 不做上下文窗口裁剪/压缩（memory 模块职责）。
- 不引入模板引擎（`{{var}}` 用正则简单替换，复用优先且无依赖）。
- 不改 `RuleLoader` / `CapabilityRegistry` 的检索行为（已由上一 change 落地）。

## Decisions

### D1: `rules` 作为内置变量，经 `{{rules}}` 占位符注入

**选择**：`buildSystemPrompt` 把 `rules` 作为内置变量并入 `variables`，模板通过 `{{rules}}` 声明注入点；同时，若模板未含 `{{rules}}` 且规则文本非空，兜底追加到末尾。

**理由**：配置示例（AGENTS.md 7.2）已显式使用 `{{rules}}`，占位符让用户控制注入位置；兜底追加避免「漏写 `{{rules}}` 导致规则静默失效」的坑，契合「组装片段」的设计意图。

**备选**：仅追加、不提供占位符。缺点：无法控制注入位置，提示词可读性差。**否决**。

### D2: 模板渲染用正则，不引模板引擎

**选择**：`template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, ...)` 手动替换。

**理由**：需求仅「`{{var}}` 文本替换」，无逻辑/循环/过滤器；引入 mustache/handlebars 等属重复造轮子，违背「复用优先但拒绝多余依赖」。正则零依赖、可测、语义单一。

**备选**：mustache / handlebars / eta。缺点：为单一能力拖入完整模板引擎。**否决**。

### D3: AgentLoop.systemPrompt 函数式，而非内嵌 RuleLoader

**选择**：`systemPrompt: string | ((userInput) => string | Promise<string>)`；组装逻辑（`buildSystemPrompt`）在调用方/context 模块，AgentLoop 只负责「取到本次 system prompt」。

**理由**：保持 AgentLoop 单一职责（执行循环），不反向依赖规则检索；调用方可用 `buildSystemPrompt` 组装，也可自定义任意逻辑，解耦且可测。

**备选**：AgentLoop 直接接收 `RuleLoader` / `AgentConfig` 自己组装。缺点：内核耦合配置细节，违背「内核与能力解耦」。**否决**。

### D4: 未提供变量保留原样，null/undefined 替换为空串

**选择**：`{{name}}` 若 `variables` 无该 key 则保留 `{{name}}`；有 key 但值为 null/undefined 则替换为空串。

**理由**：保留原样便于发现「漏配变量」（模板残留 `{{xxx}}` 是显式信号），而 null/undefined 语义是「该变量可选、当前为空」，应消隐而非残留。

## Risks / Trade-offs

- [正则替换非完整模板语义] → 仅支持 `{{var}}`，不支持嵌套/过滤器；当前需求足够，若未来需逻辑模板再升级（隔离在 `renderTemplate` 内）。
- [兜底追加与占位符并存] → 若模板既有 `{{rules}}` 又期望无占位符行为，兜底不会触发（有占位符即走占位符分支），语义确定。
- [`SystemPromptInput` 类型放宽] → `string` 仍是子集，无 breaking change；类型为 union，调用方需用 `typeof === 'function'` 收窄（已在 `resolveSystemPrompt` 内处理）。

## Migration Plan

无迁移：`systemPrompt: string` 向后兼容；新增 context 模块为纯增量。调用方如需「按需注入规则」，改用 `buildSystemPrompt(query, { systemPrompt, ruleLoader })` 作为函数式 systemPrompt 传入 AgentLoop。

## Open Questions

- skills / plugins 的 prompt 片段注入方式（占位符 vs 追加 vs 独立片段），待推广 5.5 时再定。
