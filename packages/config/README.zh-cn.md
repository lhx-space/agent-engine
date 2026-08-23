# @agent-engine/config

配置加载与 Schema。将 YAML / JSON5 / TypeScript 三种格式归一化为同一份 `AgentConfig`（Zod 校验）。

## 核心能力

- **`AgentConfigSchema`**：八大配置项的 Zod Schema（model / systemPrompt / rules / tools / mcp / skills / memory / hooks / plugins / orchestration），`z.infer` 衍生 TS 类型。
- **`loadAgentConfig(path)`**：按扩展名选择解析器，解析后经 Zod 校验，失败抛含路径与原因的错误。

## API

```ts
import { AgentConfigSchema, loadAgentConfig } from '@agent-engine/config';

const config = await loadAgentConfig('./agents/devops-agent.yaml');
// config: AgentConfig（z.infer 衍生类型）
```

## 设计要点

- **Zod 4 单一事实来源**：Schema 一律用 Zod 定义，`z.infer` 衍生类型，前端表单与编辑器复用同一份 Schema。
- **三格式归一化**：`.yaml` → `yaml`，`.json`/`.json5` → `json5`（兼容注释），`.ts` → `jiti`；三者产出等价的 `AgentConfig`。
- **多模型设计（能力分离 + 实例级覆盖）**：默认 `model`（chat）；embedding 用独立字段（能力维度分开）；subagent 模型在 subagent 定义里覆盖（角色维度实例级），详见 `AGENTS.md` 7.3。

## 依赖

- `zod`（Schema 校验 + `toJSONSchema`）
- `yaml` / `json5` / `jiti`（三格式解析）

## 状态

✅ 已实现（M1）。
