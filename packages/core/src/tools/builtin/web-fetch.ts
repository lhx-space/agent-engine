import { z } from 'zod';
import type { WebPolicy } from '@agent-engine/config';
import type { Tool } from '../types';
import { isDomainAllowed } from '../utils/domain';
import { extractContent } from '../utils/html';
import { defaultFetch } from '../utils/http';
import type { FetchLike } from '../utils/http';

// ============ 类型 ============

/** web_fetch 入参。 */
export interface WebFetchInput {
  url: string;
}

/** web_fetch 结果。 */
export interface WebFetchResult {
  url: string;
  title: string;
  content: string;
  truncated: boolean;
}

// ============ schema ============

const WebFetchInputSchema = z.object({ url: z.string().url() });

// ============ 工具 ============

/** 创建 `web_fetch` 内置工具：fetch → 状态/类型校验 → 提取正文 → 截断。 */
export function createWebFetchTool(
  policy: WebPolicy,
  fetchImpl: FetchLike = defaultFetch,
): Tool<WebFetchInput, WebFetchResult> {
  return {
    name: 'builtin.web_fetch',
    description: 'Fetch a web page URL and return its extracted main text (not raw HTML).',
    inputSchema: WebFetchInputSchema,
    execute: async ({ url }) => {
      if (!isDomainAllowed(policy, url)) {
        throw new Error(`Blocked: web_fetch domain not allowed for "${url}"`);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`web_fetch failed: HTTP ${response.status}`);
        }
        const contentType = response.contentType ?? '';
        if (contentType && !contentType.includes('text/html')) {
          throw new Error(`web_fetch unsupported content-type: ${contentType}`);
        }

        const html = await response.text();
        const { title, content } = extractContent(html);
        const max = policy.maxOutputBytes;
        if (content.length > max) {
          return {
            url,
            title,
            content: `${content.slice(0, max)}\n... (truncated)`,
            truncated: true,
          };
        }
        return { url, title, content, truncated: false };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
