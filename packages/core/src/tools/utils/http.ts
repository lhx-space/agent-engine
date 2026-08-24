/** 简化 HTTP 响应抽象（便于测试注入假实现）。 */
export interface HttpResponse {
  ok: boolean;
  status: number;
  contentType: string | null;
  /** 原始响应头（key 小写），供 `content-length` 预检等。 */
  headers?: Record<string, string>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** fetch 初始化参数（可注入抽象的最小集）。 */
export interface FetchInit {
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

/** 可注入的 fetch 抽象。 */
export type FetchLike = (url: string, init?: FetchInit) => Promise<HttpResponse>;

const DEFAULT_USER_AGENT = 'agent-engine/0.1 (+https://github.com/agent-engine)';

/** 默认实现：包装全局 fetch 为 HttpResponse，缺省补 User-Agent。 */
export const defaultFetch: FetchLike = async (url, init) => {
  const response = await fetch(url, {
    signal: init?.signal,
    method: init?.method,
    headers: init?.headers ?? { 'user-agent': DEFAULT_USER_AGENT },
    body: init?.body,
  });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type'),
    headers,
    text: () => response.text(),
    json: () => response.json(),
  };
};
