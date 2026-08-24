import OpenAI from 'openai';
import type { ModelConfig } from '@agent-engine/config';
import type {
  ChatCompletionParams,
  ChatCompletionResult,
  ChatMessage,
  LLMProvider,
  ToolCall,
  ToolDefinition,
} from './types';

function resolveApiKey(config: ModelConfig): string {
  // 内核只消费配置里显式提供的 apiKey；环境变量兜底由上层（server/cli）的 providerFactory 注入。
  return config.apiKey ?? '';
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

/** 流式 tool_calls 分片聚合器：按 index 累积 name/arguments，返回完整 ToolCall 列表。 */
class StreamToolCallAccumulator {
  private readonly calls = new Map<number, { id: string; name: string; arguments: string }>();

  /** 累积一个流式分片（delta.tool_calls 单项）。 */
  add(
    index: number,
    part: { id?: string; function?: { name?: string; arguments?: string } } | undefined,
  ): void {
    if (part == null) return;
    const existing = this.calls.get(index) ?? { id: '', name: '', arguments: '' };
    existing.id = part.id ?? existing.id;
    existing.name = part.function?.name ?? existing.name;
    existing.arguments += part.function?.arguments ?? '';
    this.calls.set(index, existing);
  }

  /** 按 index 排序产出完整 ToolCall 列表。 */
  finalize(): ToolCall[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => ({
        id: call.id,
        type: 'function' as const,
        function: { name: call.name, arguments: call.arguments },
      }));
  }
}

export function createOpenAIProvider(config: ModelConfig): LLMProvider {
  const apiKey = resolveApiKey(config);
  if (!apiKey) {
    throw new Error(
      'OpenAI-compatible provider requires config.model.apiKey (inject via providerFactory, e.g. from DEEPSEEK_API_KEY/OPENAI_API_KEY)',
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: config.baseURL ?? 'https://api.deepseek.com',
  });

  const baseRequest = (params: ChatCompletionParams) => ({
    model: config.model,
    messages: params.messages.map(toOpenAIMessage),
    tools: params.tools?.map(toOpenAITool),
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    ...(params.signal ? { signal: params.signal } : {}),
  });

  return {
    name: config.provider,
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      const response = await client.chat.completions.create(baseRequest(params));

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

    async chatCompletionStream(
      params: ChatCompletionParams,
      onDelta: (delta: string) => void,
    ): Promise<ChatCompletionResult> {
      const stream = await client.chat.completions.create({
        ...baseRequest(params),
        stream: true,
      });

      let content = '';
      let finishReason: string | undefined;
      const toolCalls = new StreamToolCallAccumulator();

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta;
        if (delta?.content) {
          content += delta.content;
          onDelta(delta.content);
        }
        for (const part of delta?.tool_calls ?? []) {
          toolCalls.add(part.index, part);
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      return {
        message: {
          role: 'assistant',
          content,
          toolCalls: toolCalls.finalize().length > 0 ? toolCalls.finalize() : undefined,
        },
        finishReason,
      };
    },
  };
}
