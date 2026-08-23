import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

/** 从 HTML 提取正文文本；readability 失败时退化为去标签文本。 */
export function extractContent(html: string): { title: string; content: string } {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  if (article?.textContent) {
    return { title: article.title ?? '', content: article.textContent.trim() };
  }
  const fallback = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { title: '', content: fallback };
}
