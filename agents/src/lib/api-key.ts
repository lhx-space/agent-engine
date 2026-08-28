const KEY = 'lhx-agent-engine:api-key';

/** 读取前端配置的 API Key（localStorage；SSR 时返回空）。 */
export function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(KEY) ?? '';
}

/** 保存前端配置的 API Key。 */
export function setApiKey(value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, value);
}
