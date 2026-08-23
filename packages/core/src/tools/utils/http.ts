/** 简化 HTTP 响应抽象（便于测试注入假实现）。 */
export interface HttpResponse {
  ok: boolean;
  status: number;
  contentType: string | null;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** 可注入的 fetch 抽象。 */
export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<HttpResponse>;

/** 默认实现：包装全局 fetch 为 HttpResponse。 */
export const defaultFetch: FetchLike = async (url, init) => {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type'),
    text: () => response.text(),
    json: () => response.json(),
  };
};
