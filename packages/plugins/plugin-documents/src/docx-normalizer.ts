import mammoth from 'mammoth';
import { htmlToMarkdown } from './html-to-markdown';
import type { Document, DocumentNormalizer, NormalizeInput } from './types';

function toBuffer(content: string | Uint8Array): Buffer {
  return Buffer.from(content);
}

/** docx 归一化器：`mammoth` 转语义 HTML → `turndown` 转 Markdown（标题/列表结构保留）。 */
export class DocxNormalizer implements DocumentNormalizer {
  readonly name = 'docx';
  readonly extensions = ['docx'] as const;

  async normalize(input: NormalizeInput): Promise<Document> {
    const { value: html } = await mammoth.convertToHtml({ buffer: toBuffer(input.content) });
    return { path: input.path, markdown: htmlToMarkdown(html), metadata: {} };
  }
}
