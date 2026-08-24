import { stringify as stringifyYaml } from 'yaml';
import type { AgentConfig } from '@agent-engine/config/schema';

export type ExportFormat = 'yaml' | 'json';

/** 把文件名里的非法字符替换为下划线（防路径注入 / 非法名）。 */
function safeName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\s]+/g, '_');
  return cleaned || 'agent-config';
}

/** 序列化当前配置为指定格式文本。 */
export function serializeConfig(config: AgentConfig, format: ExportFormat): string {
  if (format === 'yaml') {
    return stringifyYaml(config);
  }
  return JSON.stringify(config, null, 2);
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
