import type { ChatMessage } from '../llm/types';
import type { ConversationMessage, ConversationRole } from './types';

/** `ChatMessage` → 持久化消息（工具调用结构化保留，回放时可折叠）。 */
export function toConversationMessage(message: ChatMessage): ConversationMessage {
  return {
    role: message.role as ConversationRole,
    ...(message.content !== undefined ? { content: message.content } : {}),
    ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.name ? { name: message.name } : {}),
  };
}

/** 持久化消息 → `ChatMessage`（用于把历史注入上下文窗口）。 */
export function toChatMessage(message: ConversationMessage): ChatMessage {
  return {
    role: message.role,
    ...(message.content !== undefined && message.content !== null
      ? { content: message.content }
      : {}),
    ...(message.toolCalls ? { toolCalls: message.toolCalls as ChatMessage['toolCalls'] } : {}),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.name ? { name: message.name } : {}),
  } as ChatMessage;
}
