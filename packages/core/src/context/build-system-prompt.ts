import type { SystemPrompt } from '@agent-engine/config';
import type { RuleLoader } from '../rules/loader';

/**
 * 渲染模板变量：`{{name}}` → 变量值。
 * - 未提供的变量保留原样（`{{name}}` 不替换）；
 * - 值为 null / undefined 时替换为空串。
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
    const name = key.trim();
    if (!Object.prototype.hasOwnProperty.call(variables, name)) {
      return match;
    }
    const value = variables[name];
    return value == null ? '' : String(value);
  });
}

export interface BuildSystemPromptOptions {
  /** system-prompt 模板与用户变量。 */
  systemPrompt: SystemPrompt;
  /** 规则按需加载器（可选，未提供则不注入规则）。 */
  ruleLoader?: RuleLoader;
}

/**
 * 组装本次调用的 system prompt：
 * 1. 模板渲染（用户变量 + 内置 `rules` 变量）；
 * 2. 模板未声明 `{{rules}}` 占位符时，规则文本追加到末尾兜底。
 *
 * `rules` 为内置变量：值为 `ruleLoader.loadForQuery(query)` 的结果，
 * 无候选或未提供 loader 时为空串。
 */
export function buildSystemPrompt(query: string, options: BuildSystemPromptOptions): string {
  const rulesText = options.ruleLoader?.loadForQuery(query) ?? '';

  const variables: Record<string, unknown> = {
    ...(options.systemPrompt.variables ?? {}),
    rules: rulesText,
  };
  const rendered = renderTemplate(options.systemPrompt.template, variables);

  const hasRulesPlaceholder = /\{\{\s*rules\s*\}\}/.test(options.systemPrompt.template);
  if (rulesText && !hasRulesPlaceholder) {
    return `${rendered}\n\n${rulesText}`;
  }
  return rendered;
}
