import type { Document, DocumentNormalizer, NormalizeInput } from './types';

function decode(content: string | Uint8Array): string {
  return typeof content === 'string' ? content : new TextDecoder().decode(content);
}

/** text/markdown 归一化器：透传（本身已是 Markdown 形态）。 */
export class TextNormalizer implements DocumentNormalizer {
  readonly name = 'text';
  readonly extensions = ['md', 'markdown', 'txt', 'text'] as const;

  async normalize(input: NormalizeInput): Promise<Document> {
    return { path: input.path, markdown: decode(input.content), metadata: {} };
  }
}
