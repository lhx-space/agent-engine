import { z } from 'zod';
import type { WebPolicy } from '@lhx-agent-engine/config';
import type { Tool } from '@lhx-agent-engine/core/tools';
import { isDomainAllowed } from './domain';
import { extractContent } from './html';
import { defaultFetch } from '@lhx-agent-engine/core';
import type { FetchLike } from '@lhx-agent-engine/core';

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

/** HTML 原始字节相对「提取正文」的经验上限倍数（正文占比通常 <5%）。 */
const CONTENT_LENGTH_MULTIPLIER = 20;

/** 创建 `web_fetch` 内置工具：fetch → 状态/长度/类型校验 → 提取正文 → 截断。 */
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
        // Jina Reader：把网页转成干净 markdown（解决 JS 渲染 / 反爬 / 噪音内容）。
        if (policy.renderer === 'jina') {
          const jinaUrl = `https://r.jina.ai/${url}`;
          const jinaResponse = await fetchImpl(jinaUrl, { signal: controller.signal });
          if (!jinaResponse.ok) {
            throw new Error(`web_fetch jina failed: HTTP ${jinaResponse.status}`);
          }
          const jinaContent = (await jinaResponse.text()).trim();
          const jinaMax = policy.maxOutputBytes;
          if (jinaContent.length > jinaMax) {
            return {
              url,
              title: url,
              content: `${jinaContent.slice(0, jinaMax)}\n... (truncated)`,
              truncated: true,
            };
          }
          return { url, title: url, content: jinaContent, truncated: false };
        }

        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`web_fetch failed: HTTP ${response.status}`);
        }

        // content-length 预检：提前拒绝超大响应，避免下载后再截断。
        const declaredLength = Number(response.headers?.['content-length'] ?? 0);
        if (declaredLength > policy.maxOutputBytes * CONTENT_LENGTH_MULTIPLIER) {
          throw new Error(
            `web_fetch content too large: ${declaredLength} bytes exceeds ${policy.maxOutputBytes * CONTENT_LENGTH_MULTIPLIER} bytes limit`,
          );
        }

        const contentType = (response.contentType ?? '').toLowerCase();
        const isHtml =
          contentType.includes('text/html') || contentType.includes('application/xhtml+xml');

        let title: string;
        let content: string;
        if (isHtml) {
          const html = await response.text();
          const extracted = extractContent(html);
          title = extracted.title;
          content = extracted.content;
        } else if (contentType.startsWith('text/')) {
          // 纯文本源（GitHub raw / README / 日志）：直接返回正文文本。
          content = (await response.text()).trim();
          title = url;
        } else {
          throw new Error(`web_fetch unsupported content-type: ${contentType}`);
        }

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
