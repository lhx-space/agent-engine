import type { GuardrailRule } from './types';

/** 规则注册表：管理 guardrail 规则实现，按 id 查询、按触发节点过滤。 */
export class RuleRegistry {
  private readonly rules = new Map<string, GuardrailRule>();

  /** 注册规则实现。同名后者覆盖。 */
  register(rule: GuardrailRule): void {
    this.rules.set(rule.id, rule);
  }

  get(id: string): GuardrailRule | undefined {
    return this.rules.get(id);
  }

  list(): GuardrailRule[] {
    return [...this.rules.values()];
  }

  /** 返回挂载在指定节点的规则。 */
  forPoint(point: GuardrailRule['on']): GuardrailRule[] {
    return this.list().filter((rule) => rule.on === point);
  }
}
