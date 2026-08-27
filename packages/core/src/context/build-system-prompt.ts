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
 * 组装 system prompt（纯组装，不检索）：渲染 `SystemPrompt` 模板对象的用户变量。
 * rules / skills 能力注入已外放为 `plugin-rules` / `plugin-skills`，经 `ContextContributor`
 * 追加文本，不再占用模板占位符；本函数只负责模板渲染。
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  return renderTemplate(options.systemPrompt.template, options.systemPrompt.variables ?? {});
}
