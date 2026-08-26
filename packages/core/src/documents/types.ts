/** 归一化后的文档（统一为 Markdown 形态）。 */
export interface Document {
  path: string;
  markdown: string;
  metadata: Record<string, unknown>;
}

/** 分块结果。 */
export interface Chunk {
  text: string;
  metadata: Record<string, unknown>;
}

/** 归一化入参（路径 + 原始内容）。 */
export interface NormalizeInput {
  path: string;
  content: string | Uint8Array;
}

/** 文档归一化器：把异构文档统一归一化为 Markdown。 */
export interface DocumentNormalizer {
  readonly name: string;
  /** 支持的文件扩展名（不含点、小写），用于按名分派。 */
  readonly extensions: readonly string[];
  normalize(input: NormalizeInput): Promise<Document>;
}

/** 分块选项。 */
export interface ChunkerOptions {
  /** 目标块大小（字符数），默认 1000。 */
  size?: number;
  /** 相邻块重叠（字符数），默认 0。 */
  overlap?: number;
}

/** 分块器：把 Markdown 切为 `Chunk`。 */
export interface Chunker {
  chunk(markdown: string): Chunk[];
}
