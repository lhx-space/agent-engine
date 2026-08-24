## Context

WebApp 已具备三栏编辑 + 流式 chat，但模型配置是裸表单、security 全量展开、导出全量默认，用户「不知道怎么操作 / 太啰嗦」。本次纯前端优化交互，不改 config schema / core，保持「单一事实来源」（表单仍直接绑定 `AgentConfig`）。

## Goals / Non-Goals

**Goals:**

- 模型面板提供供应商预设，一键填充 `provider` / `baseURL` / `model`。
- security 默认折叠 + preset 快捷填充。
- 导出只写非默认值。

**Non-Goals:**

- 不改 `AgentConfigSchema`（「多模型」运行时语义本次不做；「多候选」由前端预设承载）。
- 不做模型路由 / fallback / 分角色（那是后续 change）。
- 不做 apiKey 加密存储（仍由 env 注入，前端只提示）。

## Decisions

### D1: 模型预设用「供应商 + 模型」两级常量表（前端，不进 schema）

**选择**：前端维护一份预设表，每项含 `{ provider, baseURL, model }`，用户点击后覆盖 `config.model` 对应字段；apiKey 不填，提示走环境变量。

**理由**：预设是「编辑体验」而非「运行时语义」，放前端最合适；若放进 schema 会再造一个「运行时用不到的死字段」。DeepSeek 双端点（OpenAI 兼容 + anthropic）都覆盖。

### D2: security 用 preset + 折叠

**选择**：`security` 卡片默认折叠；提供 strict / balanced / permissive 三档 preset，点选后填充对应字段（如 permissive 开启 bash、balanced 开启 read/write、strict 全关危险项）。展开可细调。

**理由**：`security` 十几项默认值对大多数用户是噪声；preset 让「安全默认」可一键选择，细调仍保留。

### D3: 导出只导非默认值（diff against 默认）

**选择**：序列化前递归对比当前配置与 `AgentConfigSchema.parse({ name, model, systemPrompt })` 的默认产物，省略等于默认的字段。

**理由**：默认值展开是「过于繁琐」的主因；diff 后导出更精简，且回读时 schema 会补回默认值（等价）。风险：嵌套对象的 diff 需递归处理，数组按值比较。

## Risks / Trade-offs

- [导出 diff 与默认语义] → 用 `AgentConfigSchema` 解析一个最小配置得到默认参照，递归浅对比；`undefined` 字段省略。回读后行为等价。
- [preset 覆盖用户手填值] → 点选 preset 是显式动作，覆盖前可提示（或直接覆盖，表单可回改）。

## Migration Plan

无破坏。纯前端交互，config schema / core / server 不动；导出格式仍是合法 `AgentConfig`，可被 `loadAgentConfig` 回读。
