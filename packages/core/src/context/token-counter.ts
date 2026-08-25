/**
 * Token 计数抽象：估算文本 token 数，用于上下文窗口预算与裁剪。
 * 精确 tokenizer（tiktoken 等）由用户实现本接口并经插件注入；默认用无依赖粗估。
 */
export interface TokenCounter {
  readonly name: string;
  count(text: string): number;
}

/** 开发默认：字符数 / 4 的粗估（英文均约 4 字符/词；CJK 会偏小，属粗估，生产接精确 tokenizer）。 */
export class ApproximateTokenCounter implements TokenCounter {
  readonly name = 'approximate';
  count(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
