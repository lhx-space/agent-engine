# @agent-engine/plugin-guardrails

声明式 guardrail 插件：把 `config.guardrails`（声明式配置）编译为可执行 `GuardrailRule[]`，并经 `ctx.registerGuardrail` 注入内核拦截机制。

core 只保留 `GuardrailRule` 协议（接口）与 `AgentLoop` 拦截机制；声明式编译是本插件的能力。

## 安装

```bash
pnpm add @agent-engine/plugin-guardrails
```

## 用法

```ts
import { createGuardrailsPlugin } from '@agent-engine/plugin-guardrails';

const guardrailsPlugin = createGuardrailsPlugin(config.guardrails);

// 装配时传入 plugins: [guardrailsPlugin]
```

> 配置里的 `guardrails` 切片由本插件解释（D1-A：字段不变、零迁移）。
>
> ```yaml
> guardrails:
>   - id: deny-bash
>     denyTools: [builtin.bash]
>   - id: redact
>     on: afterToolCall
>     denyPatterns: [password]
> ```

## API

- `createGuardrailsPlugin(configs)` — 返回编译并注册 `GuardrailRule[]` 的 `Plugin`。
- `createDeclarativeGuardrail(config)` — 编译单条声明式配置为 `GuardrailRule`。
- `compileGuardrails(configs)` — 编译配置数组。
