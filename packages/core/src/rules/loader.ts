import type { Rule } from '@agent-engine/config';
import { CapabilityRegistry } from '../retrieval/registry';

/**
 * 规则按需加载器：把 rules 注册进 CapabilityRegistry，
 * 按 query 输出「本次注入的规则文本」——always 全注入 + on-demand BM25 召回。
 */
export class RuleLoader {
  private readonly registry: CapabilityRegistry;
  private readonly rules: Map<string, Rule>;

  constructor(rules: Rule[], registry?: CapabilityRegistry) {
    this.registry = registry ?? new CapabilityRegistry();
    this.rules = new Map(rules.map((rule) => [rule.id, rule]));
    for (const rule of rules) {
      this.registry.register({
        id: rule.id,
        type: 'rule',
        description: rule.description,
        tags: rule.tags,
      });
    }
  }

  /** 输出本次注入的规则文本（always + top-k on-demand），无候选时返回空串。 */
  loadForQuery(query: string, topK = 5): string {
    const always = [...this.rules.values()].filter((rule) => rule.kind === 'always');

    const hits = this.registry.retrieve(query, topK);
    const onDemand = hits
      .filter((hit) => hit.meta.type === 'rule')
      .map((hit) => this.rules.get(hit.meta.id))
      .filter((rule): rule is Rule => rule !== undefined);

    const seen = new Set<string>();
    const parts: string[] = [];
    for (const rule of [...always, ...onDemand]) {
      if (seen.has(rule.id)) continue;
      seen.add(rule.id);
      parts.push(rule.content);
    }
    return parts.join('\n\n');
  }
}
