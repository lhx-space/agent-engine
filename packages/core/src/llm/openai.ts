import OpenAI from 'openai';
import type { ModelConfig } from '@agent-engine/config';
import type {
  ChatCompletionParams,
  ChatCompletionResult,
  ChatMessage,
  LLMProvider,
  ToolCall,
  ToolDefinition,
} from './types.js';

function resolveApiKey(): string {
  return process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
}

function toOpenAIToolCall(
  toolCall: ToolCall,
): OpenAI.Chat.Completions.ChatCompletionMessageToolCall {
  return {
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  };
}

function toOpenAIMessage(message: ChatMessage): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  switch (message.role) {
    case 'system':
      return { role: 'system', content: message.content };
    case 'user':
      return { role: 'user', content: message.content };
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.toolCalls?.map(toOpenAIToolCall),
      };
    case 'tool':
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId ?? '',
      };
  }
}

function toOpenAITool(tool: ToolDefinition): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  };
}

function fromOpenAIToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
): ToolCall | null {
  // custom tool call（OpenAI 自定义工具）首版不支持，忽略。
  if (toolCall.type !== 'function') {
    return null;
  }
  return {
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  };
}

export function createOpenAIProvider(config: ModelConfig): LLMProvider {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI-compatible provider requires DEEPSEEK_API_KEY (or OPENAI_API_KEY) to be set',
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: config.baseURL ?? 'https://api.deepseek.com',
  });

  return {
    name: config.provider,
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: params.messages.map(toOpenAIMessage),
        tools: params.tools?.map(toOpenAITool),
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        ...(params.signal ? { signal: params.signal } : {}),
      });

      const choice = response.choices[0];
      const message = choice?.message;

      return {
        message: {
          role: 'assistant',
          content: message?.content ?? '',
          toolCalls: message?.tool_calls
            ?.map(fromOpenAIToolCall)
            .filter((toolCall): toolCall is ToolCall => toolCall !== null),
        },
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        finishReason: choice?.finish_reason ?? undefined,
      };
    },
  };
}
