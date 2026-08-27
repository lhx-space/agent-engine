import { extractText, getDocumentProxy } from 'unpdf';
import type { Document, DocumentNormalizer, NormalizeInput } from './types';

function toBytes(content: string | Uint8Array): Uint8Array {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  // pdf.js 拒绝 Node Buffer（要求「纯」Uint8Array），故复制一份。
  return new Uint8Array(content);
}

/** PDF 归一化器：`unpdf`（服务端 pdf.js）抽取文本层，产出纯文本（Markdown 透传形态）。 */
export class PdfNormalizer implements DocumentNormalizer {
  readonly name = 'pdf';
  readonly extensions = ['pdf'] as const;

  async normalize(input: NormalizeInput): Promise<Document> {
    const pdf = await getDocumentProxy(toBytes(input.content));
    const { text } = await extractText(pdf, { mergePages: true });
    return { path: input.path, markdown: text, metadata: {} };
  }
}
