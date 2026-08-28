import { stringify as stringifyYaml } from 'yaml';
import {
  defaultSecurityConfig,
  type AgentConfig,
  type ModelConfig,
  type SecurityConfig,
} from '@lhx-agent-engine/config/schema';

export type ExportFormat = 'yaml' | 'json';

/** 把文件名里的非法字符替换为下划线（防路径注入 / 非法名）。 */
function safeName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\s]+/g, '_');
  return cleaned || 'agent-config';
}

/** 深比较（纯数据对象，JSON 序列化比较够用）。 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 递归省略「等于默认值」的字段；全默认返回 undefined。 */
function pruneByDefaults<T extends Record<string, unknown>>(value: T, defaults: T): T | undefined {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const v = value[key];
    const d = defaults[key];
    if (deepEqual(v, d)) continue;
    result[key] = v;
  }
  return Object.keys(result).length === 0 ? undefined : (result as T);
}

/** 精简 security：省略等于默认值的子块/字段，全默认则整体省略。 */
function pruneSecurity(security: SecurityConfig): SecurityConfig | undefined {
  const pruned: Record<string, unknown> = {};
  for (const key of Object.keys(security) as (keyof SecurityConfig)[]) {
    const sub = pruneByDefaults(
      security[key] as Record<string, unknown>,
      defaultSecurityConfig[key] as Record<string, unknown>,
    );
    if (sub !== undefined) pruned[key] = sub;
  }
  return Object.keys(pruned).length === 0 ? undefined : (pruned as SecurityConfig);
}

/** 精简 model：省略 undefined 的可选字段，保留 provider / model。 */
function pruneModel(model: ModelConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { provider: model.provider, model: model.model };
  if (model.baseURL) out.baseURL = model.baseURL;
  if (model.apiKey) out.apiKey = model.apiKey;
  if (model.temperature !== undefined) out.temperature = model.temperature;
  if (model.maxTokens !== undefined) out.maxTokens = model.maxTokens;
  return out;
}

/** 导出前精简：省略等于默认值的字段与空数组，只保留非默认配置。 */
function minimize(config: AgentConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: config.name,
    model: pruneModel(config.model),
    systemPrompt: config.systemPrompt,
  };

  if (config.description) out.description = config.description;
  if (config.version) out.version = config.version;
  if (config.rules.length > 0) out.rules = config.rules;
  if (config.tools.disabled.length > 0) out.tools = config.tools;
  if (config.skills.length > 0) out.skills = config.skills;
  if ((config.mcp?.servers.length ?? 0) > 0) out.mcp = config.mcp;
  if (config.memory) out.memory = config.memory;
  if (config.hooks.length > 0) out.hooks = config.hooks;
  if (config.plugins.length > 0) out.plugins = config.plugins;
  if (config.orchestration && config.orchestration.mode !== 'single') {
    out.orchestration = config.orchestration;
  }
  if (config.execution) out.execution = config.execution;

  const security = pruneSecurity(config.security);
  if (security !== undefined) out.security = security;

  return out;
}

/** 序列化当前配置为指定格式文本（省略默认值，导出更精简）。 */
export function serializeConfig(config: AgentConfig, format: ExportFormat): string {
  const minimal = minimize(config);
  if (format === 'yaml') {
    return stringifyYaml(minimal);
  }
  return JSON.stringify(minimal, null, 2);
}

/** 把当前配置导出为文件并触发浏览器下载。 */
export function exportConfig(config: AgentConfig, format: ExportFormat): void {
  const content = serializeConfig(config, format);
  const name = config.name;
  const filename = `${safeName(name)}.${format}`;
  const mime = format === 'yaml' ? 'application/yaml' : 'application/json';

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
