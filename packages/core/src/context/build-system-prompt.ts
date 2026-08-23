import type { BuildSystemPromptOptions } from './types';

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

/**
 * 组装 system prompt（纯组装，不检索）：
 * 1. 模板渲染（用户变量 + 内置 `rules` / `skills` 变量）；
 * 2. 模板未声明对应占位符时，rules / skills 文本追加到末尾兜底。
 *
 * `rules` / `skills` 为内置变量：值为 `options.rulesText` / `options.skillsText`。
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const rulesText = options.rulesText ?? '';
  const skillsText = options.skillsText ?? '';

  const variables: Record<string, unknown> = {
    ...(options.systemPrompt.variables ?? {}),
    rules: rulesText,
    skills: skillsText,
  };
  const rendered = renderTemplate(options.systemPrompt.template, variables);

  const template = options.systemPrompt.template;
  const fallback: string[] = [];
  if (rulesText && !/\{\{\s*rules\s*\}\}/.test(template)) {
    fallback.push(rulesText);
  }
  if (skillsText && !/\{\{\s*skills\s*\}\}/.test(template)) {
    fallback.push(skillsText);
  }
  return fallback.length > 0 ? `${rendered}\n\n${fallback.join('\n\n')}` : rendered;
}
