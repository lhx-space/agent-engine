import type { Chunk, Chunker, ChunkerOptions } from './types';

const DEFAULT_SIZE = 1000;

/** 尽量在换行边界切，按 size + overlap 把文本切成块（避免拆散段落/行）。 */
function splitBySize(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const newline = text.lastIndexOf('\n', end);
      if (newline > start) end = newline;
    }
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/** 固定大小分块（size + overlap，尽量在换行边界切）。 */
export class FixedSizeChunker implements Chunker {
  private readonly size: number;
  private readonly overlap: number;

  constructor(options: ChunkerOptions = {}) {
    this.size = options.size ?? DEFAULT_SIZE;
    this.overlap = options.overlap ?? 0;
  }

  chunk(markdown: string): Chunk[] {
    return splitBySize(markdown, this.size, this.overlap).map((text) => ({ text, metadata: {} }));
  }
}

/** 按 Markdown 标题（`#{1,6}`）切段；单段超 size 回落固定切。 */
export class MarkdownHeadingChunker implements Chunker {
  private readonly size: number;
  private readonly overlap: number;

  constructor(options: ChunkerOptions = {}) {
    this.size = options.size ?? DEFAULT_SIZE;
    this.overlap = options.overlap ?? 0;
  }

  chunk(markdown: string): Chunk[] {
    const headingRe = /^(#{1,6})\s+(.+)$/gm;
    const sections: { heading: string; content: string }[] = [];
    let lastIndex = 0;
    let lastHeading = '';

    for (const match of markdown.matchAll(headingRe)) {
      if (match.index === undefined) continue;
      if (match.index > lastIndex) {
        sections.push({ heading: lastHeading, content: markdown.slice(lastIndex, match.index) });
      }
      lastHeading = match[2] ?? '';
      lastIndex = match.index;
    }
    sections.push({ heading: lastHeading, content: markdown.slice(lastIndex) });

    const chunks: Chunk[] = [];
    for (const section of sections) {
      const text = section.content.trim();
      if (text.length === 0) continue;
      if (text.length <= this.size) {
        chunks.push({ text, metadata: section.heading ? { heading: section.heading } : {} });
        continue;
      }
      splitBySize(text, this.size, this.overlap).forEach((piece, index) => {
        chunks.push({
          text: piece,
          metadata: section.heading && index === 0 ? { heading: section.heading } : {},
        });
      });
    }
    return chunks;
  }
}
