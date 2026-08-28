# @lhx-agent-engine/config

配置加载与 Schema。将 YAML / JSON5 / TypeScript 三种格式归一化为同一份 `AgentConfig`（Zod 校验、深度冻结）。

## 安装

```bash
pnpm add @lhx-agent-engine/config
```

## 核心能力

- **`AgentConfigSchema`**：全部配置轴的 Zod Schema——`model` / `systemPrompt` / `rules` / `guardrails` / `tools` / `mcp` / `skills` / `memory` / `cache` / `embedding` / `hooks` / `plugins` / `orchestration` / `execution` / `security`，`z.infer` 衍生 TS 类型。
- **`loadAgentConfig(path, options?)`**：按扩展名选择解析器，解析后经 Zod 校验，失败抛含路径与原因的错误。
- **`deepFreeze` / `sanitizeConfigValue`**：供任何配置边界做纵深防御复用。

## 子路径导出

| 子路径                            | 内容                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- |
| `@lhx-agent-engine/config`        | `AgentConfigSchema`、`loadAgentConfig`、`deepFreeze`、`sanitizeConfigValue` |
| `@lhx-agent-engine/config/schema` | 全部 Zod Schema 与衍生类型                                                  |

## API

```ts
import { AgentConfigSchema, loadAgentConfig } from '@lhx-agent-engine/config';

const config = await loadAgentConfig('./agents/devops-agent.yaml');
// config: AgentConfig（z.infer 衍生类型，深度冻结不可变）

// TypeScript 配置默认拒绝，需显式开启：
const tsConfig = await loadAgentConfig('./agents/local.ts', { allowTsConfig: true });
```

## 安全默认

- **TS 配置默认拒绝**：`.ts`/`.mts`/`.cts` 会被当作代码执行，仅在 `allowTsConfig: true` 时加载，仅用于受信任的本地开发输入。
- **入口 sanitize**：校验前递归剔除 `__proto__`/`constructor`/`prototype` 危险 key，防原型污染。
- **出口 deepFreeze**：校验后深度冻结产物，防运行时篡改。
- **资源限制**：解析前限制文件大小（默认 1 MiB）；YAML 显式 `maxAliasCount` + `uniqueKeys` 防别名炸弹与重复 key。

## 设计要点

- **Zod 4 单一事实来源**：Schema 一律用 Zod 定义，`z.infer` 衍生类型，前端表单与编辑器复用同一份 Schema。
- **三格式归一化**：`.yaml` → `yaml`，`.json`/`.json5` → `json5`（兼容注释），`.ts` → `jiti`；三者产出等价的 `AgentConfig`。
- **多模型设计（能力分离 + 实例级覆盖）**：默认 `model`（chat）；`embedding` 用独立字段（能力维度分开）；subagent 模型在 subagent 定义里覆盖（角色维度实例级），详见 `AGENTS.md` 7.3。

## 依赖

- `zod`（Schema 校验）
- `yaml` / `json5` / `jiti`（三格式解析）

## 状态

✅ 已实现。
