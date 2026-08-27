import TurndownService from 'turndown';

/** 共享 turndown 单例：HTML 片段 → Markdown（ATX 标题），供各归一化器复用。 */
const turndown = new TurndownService({ headingStyle: 'atx' });

/** 把 HTML 片段转 Markdown（统一归一化形态）。 */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}
