import type { Rule } from '@agent-engine/config';
import type { CapabilityLoader } from '../retrieval/loader';

/**
 * 规则按需加载：`always` 规则 content 全注入 + `on-demand` 规则经
 * `CapabilityLoader` 检索（BM25，配置 embedding 时 BM25+向量 RRF）召回 top-k 的 content，
 * 去重拼接为「本次注入的规则文本」。
 */
export async function loadRulesText(
  rules: Rule[],
  loader: CapabilityLoader<Rule>,
  query: string,
  topK = 5,
): Promise<string> {
  const always = rules.filter((rule) => rule.kind === 'always');
  const onDemand = (await loader.loadForQuery(query, topK)).map((hit) => hit.record);

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const rule of [...always, ...onDemand]) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    parts.push(rule.content);
  }
  return parts.join('\n\n');
}
