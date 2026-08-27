# @agent-engine/plugin-guardrails

Declarative guardrail plugin: compiles `config.guardrails` (declarative config) into executable `GuardrailRule[]` and registers them into the kernel's interception mechanism via `ctx.registerGuardrail`.

Core only keeps the `GuardrailRule` protocol (interface) and the `AgentLoop` interception mechanism; the declarative compilation is this plugin's capability.

## Install

```bash
pnpm add @agent-engine/plugin-guardrails
```

## Usage

```ts
import { createGuardrailsPlugin } from '@agent-engine/plugin-guardrails';

const guardrailsPlugin = createGuardrailsPlugin(config.guardrails);

// 装配时传入 plugins: [guardrailsPlugin]
```

> In config, the `guardrails` slice is interpreted by this plugin (D1-A: field unchanged, zero migration).
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

- `createGuardrailsPlugin(configs)` — returns a `Plugin` that compiles and registers `GuardrailRule[]`.
- `createDeclarativeGuardrail(config)` — compiles one declarative config into a `GuardrailRule`.
- `compileGuardrails(configs)` — compiles an array of configs.
