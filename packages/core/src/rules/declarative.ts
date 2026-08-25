import type { GuardrailRuleConfig } from '@agent-engine/config';
import type { GuardrailRule } from './types';

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
