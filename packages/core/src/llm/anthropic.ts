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

  const buildRequest = (params: ChatCompletionParams) => {
    const system = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const messages = params.messages.filter((m) => m.role !== 'system').map(toAnthropicMessage);

    return {
      model: config.model,
      max_tokens: params.maxTokens ?? 4096,
      system: system || undefined,
      messages,
      tools: params.tools?.map(toAnthropicTool),
      temperature: params.temperature,
    };
  };

  return {
    name: 'anthropic',
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      const response = await client.messages.create(buildRequest(params));

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

    async chatCompletionStream(
      params: ChatCompletionParams,
      onDelta: (delta: string) => void,
    ): Promise<ChatCompletionResult> {
      const stream = await client.messages.create({ ...buildRequest(params), stream: true });

      let text = '';
      let finishReason: string | undefined;
      const toolCalls: ToolCall[] = [];
      // 流式下 tool_use 的 input 是分片 JSON，按 index 累积。
      const toolInputJson = new Map<number, string>();

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            text += event.delta.text;
            onDelta(event.delta.text);
          } else if (event.delta.type === 'input_json_delta') {
            const index = event.index;
            toolInputJson.set(index, (toolInputJson.get(index) ?? '') + event.delta.partial_json);
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            toolCalls.push({
              id: event.content_block.id,
              type: 'function',
              function: {
                name: event.content_block.name,
                arguments: '',
              },
            });
          }
        } else if (event.type === 'message_delta') {
          finishReason = event.delta.stop_reason ?? finishReason;
        }
      }

      // 流结束后把累积的分片 JSON 回填到对应 tool_use。
      for (const [index, json] of toolInputJson) {
        const call = toolCalls[index];
        if (call) {
          call.function.arguments = json;
        }
      }

      return {
        message: {
          role: 'assistant',
          content: text,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finishReason,
      };
    },
  };
}
