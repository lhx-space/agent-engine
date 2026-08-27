import { htmlToMarkdown } from './html-to-markdown';
import type { Document, DocumentNormalizer, NormalizeInput } from './types';

function decode(content: string | Uint8Array): string {
  return typeof content === 'string' ? content : new TextDecoder().decode(content);
}

/** HTML 归一化器：`turndown` 把 HTML 转 Markdown。 */
export class HtmlNormalizer implements DocumentNormalizer {
  readonly name = 'html';
  readonly extensions = ['html', 'htm'] as const;

  async normalize(input: NormalizeInput): Promise<Document> {
    return {
      path: input.path,
      markdown: htmlToMarkdown(decode(input.content)),
      metadata: {},
    };
  }
}
