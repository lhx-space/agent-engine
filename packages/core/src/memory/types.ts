export interface ConversationMemoryOptions {
  /**
   * 历史消息最大条数（不含 system）。
   * 超过时保留最近 `maxMessages` 条（丢弃最旧）；未设置或非正数则不裁剪。
   */
  maxMessages?: number;
}
