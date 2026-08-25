## Context

`tools` 轴是「配置即 Agent」八大项之一，但当前只有 Schema 声明、无运行期消费：`config.tools` 被解析后丢弃，`{ use: 'builtin.read_file' }` 这种引用既无解析器也无过滤逻辑（read_file 早已 plugin 化）。这带来三层漂移——spec（`plugins` 写「按 `tools` 引用装配」）、代码（`registerBuiltinTools` 恒注册、不读 `tools`）、UI（`ToolsForm` 提示陈旧工具名）。

同时文件/命令/时间三个高频工具存在能力缺口与正确性缺陷。本 change 做一次聚焦的「工具深度打磨」：让 `tools` 轴真正落地为开关（禁用），补齐 `list_files` 列举能力，修正 `datetime now` 与 `read_file` 截断的可用性。

## Goals / Non-Goals

**Goals:**

- `tools.disabled` 成为真配置轴：装配末按语义名移除任意已装配工具（builtin / plugin / mcp），并联动 todo 规划引导片段。
- `list_files` 列举能力：`roots` 约束 + 可选 `glob`（picomatch）+ `maxDepth`/`maxEntries` 防护。
- `datetime now` 支持 `timeZone`/`locale`，一次调用返回 `formatted` 完整本地化串。
- `read_file` 截断不切断多字节 UTF-8 字符。
- 源码归位：`file.ts`/`bash.ts` 移出 `builtin/`（消除「已迁出却还在 builtin」的语义错位）。

**Non-Goals:**

- 不做 `tools.enabled`（正向白名单）与按复杂度路由（M3 多模型方向）。
- 不做 glob 的 brace / extended glob 全量语义——`picomatch` 原生能力已覆盖，不自研匹配器。
- 不做文件内容的二进制探测/语法高亮/分页读取。
- 不改 `builtin.read_file` 等既有工具语义名（保持兼容，仅归位源码文件）。

## Decisions

### D1: `tools` 轴改为 `{ disabled: string[] }`，移除无消费方的 `ToolRef`/`use`

**选择**：`AgentConfig.tools` 由 `z.array(ToolRefSchema)` 改为 `ToolsConfigSchema = { disabled: z.array(z.string()).default([]) }`；删除 `ToolRefSchema`/`ToolRef`。

**理由**：`use` 自诞生起无任何运行期消费（tools 只来自 builtin / plugin / mcp，均已自动注册，无需按名「引用」），是死字段且诱导前端写 `builtin.read_file` 这种陈旧引用。「禁用」是最小、最有用的开关语义（如离线 Agent 关 `web_search`/`web_fetch`，单一用途 Agent 关 `todo`）。正向 `enabled` 白名单在能力发现/路由落地前无可靠语义，留后续。

### D2: 禁用是「装配末统一移除」，而非 registerBuiltinTools 的参数

**选择**：`assembleAgentLoop` 在「注册 builtin → 合并 plugin/mcp bundles → 注册全部工具」之后，统一执行 `registry.unregister(name)` 移除 `tools.disabled` 中的名字；todo 规划引导片段改为按「`builtin.todo` 最终是否仍在 registry」注入。

**理由**：`disabled` 要覆盖三类来源（builtin / plugin / mcp），只有在全部装配完成后做统一过滤才正确；把它塞进 `registerBuiltinTools` 只能管 builtin，是错误分层。todo 引导与 todo 工具的存续强相关，禁用 todo 后必须不再注入引导（否则 system prompt 让模型调用一个不存在的工具）。

### D3: `list_files` 复用 `picomatch`，不手写 glob

**选择**：`@agent-engine/core` 新增 `picomatch` 依赖（MIT、零依赖、micromatch/fast-glob 底层，已在 workspace 传递依赖树中），`list_files` 的 `glob` 过滤用 `picomatch(pattern, { dot: false })` 匹配相对 workspace 的 posix 路径。

**理由**：glob 匹配是成熟轮子，手写正则会重蹈「重复造轮子」覆辙（AGENTS.md 核心纪律）。`dot: false` 默认跳过 `.git`、`.DS_Store` 等隐藏项，天然安全。

### D4: `datetime now` 与 `format` 共用同一本地化渲染

**选择**：抽 `formatDate(date, locale?, timeZone?)` 内部 helper；`now` 在提供 `timeZone`/`locale` 时返回 `formatted`（`dateStyle: 'full'` + `timeStyle: 'long'`，含星期+日期+时分秒），不提供则维持现状（仅 iso + epochMs，向后兼容）。

**理由**：`now` 的高频意图就是「告诉我现在什么时候」，返回本地化完整串能让模型一次调用即答，避免「先 now 再 format」两跳。`formatted` 为可选字段，不破坏现有调用方。

### D5: `read_file` UTF-8 安全截断

**选择**：截断时从 `maxFileBytes` 边界向前回退至多 3 字节，跳过 UTF-8 连续字节（`(b & 0xc0) === 0x80`），确保不切断多字节字符。

**理由**：按字节硬切（`Buffer` 字节切片后转字符串）在边界落在多字节字符中间时会输出 `�`。回退最多 3 字节（UTF-8 单字符最长 4 字节）即可命中字符边界，代价 O(1)。

## Risks / Trade-offs

- [Breaking: `tools` 数组→对象] → 旧 `tools: [{ use }]` 无运行期消费，仅 streaming.test 与前端占位，改造成本 0；spec/UI/代码三层对齐后消除漂移。
- [`disabled` 按名字符串匹配] → 拼错名会静默无效果（`unregister` 返回 false）；可接受，与「配置即声明」一致，后续可加装配期校验/告警。
- [`list_files` 递归列举] → 大目录/深目录靠 `maxDepth`+`maxEntries` 双闸门兜底，不引入无限递归或内存爆炸；默认 `maxDepth: 1`（仅直接子项）保守。
- [picomatch 依赖] → 新增一个零依赖、MIT、生态事实标准的 glob 匹配器，符合「复用优先」；无 CJS/ESM 兼容风险（picomatch 4 为 CJS `main`）。

## Migration Plan

- 旧配置若含 `tools: [{ use: ... }]`（本项目实际无此场景），删除即可；默认 `tools.disabled: []`，行为不变。
- 前端 `ToolsForm` 从「添加工具引用」改为「勾选要禁用的内置工具」多选；`export-config` 仅当 `disabled` 非空时输出 `tools`。
- 已归档 spec 同步：`agent-config-schema`（tools 轴）、`builtin-tools`（datetime/read_file）、`plugins`（list_files + assemble 语义修正）。
