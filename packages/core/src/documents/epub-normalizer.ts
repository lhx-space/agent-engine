import { EPub } from 'epub2';
import { htmlToMarkdown } from './html-to-markdown';
import type { Document, DocumentNormalizer, NormalizeInput } from './types';

/** epub 归一化器：`epub2` 按 spine 解析章节 HTML → `turndown` 转 Markdown 拼接。 */
export class EpubNormalizer implements DocumentNormalizer {
  readonly name = 'epub';
  readonly extensions = ['epub'] as const;

  async normalize(input: NormalizeInput): Promise<Document> {
    // epub2 需真实文件路径（内部自行解包），故读 `path` 而非 `content`。
    const epub = await EPub.createAsync(input.path);
    const parts: string[] = [];
    for (const chapter of epub.flow) {
      if (!chapter.id) continue;
      const html = await epub.getChapterAsync(chapter.id);
      const markdown = htmlToMarkdown(html).trim();
      if (markdown) parts.push(chapter.title ? `# ${chapter.title}\n\n${markdown}` : markdown);
    }
    return {
      path: input.path,
      markdown: parts.join('\n\n'),
      metadata: { title: epub.metadata?.title },
    };
  }
}
