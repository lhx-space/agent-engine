import type { GuardrailRuleConfig } from '@agent-engine/config';
import type { GuardrailRule } from '@agent-engine/core/guardrails';
import type { Plugin } from '@agent-engine/core/plugins';

/**
 * 把一条声明式 guardrail 配置编译为可执行 `GuardrailRule`。
 * 判定优先级：denyTools（命中阻断）→ allowTools（非空且不在内阻断）→ denyPatterns（正则命中 args/result 阻断）→ 放行。
 * 正则编译期完成（`new RegExp`），非法模式在装配期抛可读错误（fail fast）。
 */
export function createDeclarativeGuardrail(config: GuardrailRuleConfig): GuardrailRule {
  const patterns = (config.denyPatterns ?? []).map((source) => new RegExp(source));
  const denyTools = new Set(config.denyTools ?? []);
  const allowTools = new Set(config.allowTools ?? []);

  return {
    id: config.id,
    on: config.on ?? 'beforeToolCall',
    async validate(ctx) {
      const name = ctx.toolName ?? '';
      if (denyTools.has(name)) {
        return { allowed: false, reason: `denied tool "${name}"` };
      }
      if (allowTools.size > 0 && !allowTools.has(name)) {
        return { allowed: false, reason: `tool "${name}" not in allowlist` };
      }
      const haystack = ctx.args ?? ctx.result ?? '';
      for (const pattern of patterns) {
        if (pattern.test(haystack)) {
          return { allowed: false, reason: `matched deny pattern "${pattern.source}"` };
        }
      }
      return { allowed: true };
    },
  };
}

/** 把声明式 guardrail 配置数组编译为可执行 `GuardrailRule[]`。 */
export function compileGuardrails(configs: GuardrailRuleConfig[]): GuardrailRule[] {
  return configs.map(createDeclarativeGuardrail);
}

/**
 * 创建声明式 guardrail 插件：把 `config.guardrails`（声明式配置）编译为 `GuardrailRule[]`
 * 并经 `ctx.registerGuardrail` 注入内核拦截机制。`config.guardrails` 字段的解释权移交本插件（D1-A）。
 */
export function createGuardrailsPlugin(configs: GuardrailRuleConfig[]): Plugin {
  return {
    name: '@agent-engine/plugin-guardrails',
    description: '声明式 guardrail 编译（config.guardrails → GuardrailRule）',
    version: '0.1.0',
    tags: ['guardrail', '安全', '拦截'],
    install(ctx) {
      for (const rule of compileGuardrails(configs)) {
        ctx.registerGuardrail(rule);
      }
    },
  };
}
