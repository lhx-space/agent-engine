## 1. core 目录正名

- [x] 1.1 `core/src/rules/` → `core/src/guardrails/`，import 路径同步
- [x] 1.2 测试 `rules.test.ts` → `guardrails.test.ts`
- [x] 1.3 `tsdown.config.ts` entry 与 `package.json` `./rules` → `./guardrails`

## 2. core 协议化

- [x] 2.1 删除 `RuleRegistry`（registry.ts）
- [x] 2.2 删除 `compileGuardrails` / `createDeclarativeGuardrail`（declarative.ts）
- [x] 2.3 `AgentLoop` / `assemble` / `AgentLoopOptions` 的 `guardrails` 改为 `GuardrailRule[]`
- [x] 2.4 `resolve` 不再传 `guardrailConfig`

## 3. 外放 plugin-guardrails

- [x] 3.1 新增 `@lhx-agent-engine/plugin-guardrails` 包（编译逻辑 + `createGuardrailsPlugin`）
- [x] 3.2 迁移 declarative 编译测试

## 4. 校验

- [x] 4.1 `pnpm test` / `typecheck` / `lint` / `spell` / `format:check` / `lint:md` / `build`
- [x] 4.2 `openspec validate --strict`
