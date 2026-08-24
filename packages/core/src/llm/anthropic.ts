import Anthropic from '@anthropic-ai/sdk';
import type { ModelConfig } from '@agent-engine/config';
import type {
  ChatCompletionParams,
  ChatCompletionResult,
  ChatMessage,
  LLMProvider,
  ToolCall,
  ToolDefinition,
} from './types';

type AnthropicMessage = Anthropic.Messages.MessageParam;
type AnthropicContentBlock = Anthropic.Messages.ContentBlockParam;

function toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters as Anthropic.Tool.InputSchema,
  };
}

function toAnthropicMessage(message: ChatMessage): AnthropicMessage {
  // 工具结果 → user 角色的 tool_result 块
  if (message.role === 'tool') {
    return {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: message.toolCallId ?? '',
          content: message.content,
        },
      ],
    };
  }

  // assistant 且携带工具调用 → text + tool_use 块
  if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
    const blocks: AnthropicContentBlock[] = [];
    if (message.content) {
      blocks.push({ type: 'text', text: message.content });
    }
    for (const toolCall of message.toolCalls) {
      blocks.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments) as unknown,
      });
    }
    return { role: 'assistant', content: blocks };
  }

  // user / assistant 纯文本
  return {
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content,
  };
}

export function createAnthropicProvider(config: ModelConfig): LLMProvider {
  // 内核只消费配置里显式提供的 apiKey；环境变量兜底由上层（server/cli）的 providerFactory 注入。
  const apiKey = config.apiKey ?? '';
  if (!apiKey) {
    throw new Error(
      'Anthropic provider requires config.model.apiKey (inject via providerFactory, e.g. from ANTHROPIC_API_KEY)',
    );
  }

  const client = new Anthropic({
    apiKey,
    baseURL: config.baseURL,
  });

  return {
    name: 'anthropic',
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      const system = params.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');

      const messages = params.messages.filter((m) => m.role !== 'system').map(toAnthropicMessage);

      const response = await client.messages.create({
        model: config.model,
        max_tokens: params.maxTokens ?? 4096,
        system: system || undefined,
        messages,
        tools: params.tools?.map(toAnthropicTool),
        temperature: params.temperature,
      });

      const textParts: string[] = [];
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      return {
        message: {
          role: 'assistant',
          content: textParts.join(''),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        },
        finishReason: response.stop_reason ?? undefined,
      };
    },
  };
}
