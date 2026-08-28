import OpenAI from 'openai';
import type { BaseModelConfig } from '@lhx-agent-engine/config';
import type {
  ChatCompletionParams,
  ChatCompletionResult,
  ChatMessage,
  DeltaKind,
  FinishReason,
  LLMProvider,
  ToolCall,
  ToolDefinition,
} from './types';

function resolveApiKey(config: BaseModelConfig): string {
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

/** openai `finish_reason` → 归一化 `FinishReason`。 */
function normalizeOpenAIFinishReason(reason: string | null | undefined): FinishReason | undefined {
  switch (reason) {
    case 'stop':
    case 'length':
    case 'tool_calls':
    case 'content_filter':
      return reason;
    case null:
    case undefined:
      return undefined;
    default:
      return 'unknown';
  }
}

export function createOpenAIProvider(config: BaseModelConfig): LLMProvider {
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

  // 采样参数「配置缺省 + 调用覆盖」：`params.X ?? config.X`；只透传协议支持的字段。
  const baseRequest = (params: ChatCompletionParams) => ({
    model: config.model,
    messages: params.messages.map(toOpenAIMessage),
    tools: params.tools?.map(toOpenAITool),
    temperature: params.temperature ?? config.temperature,
    max_tokens: params.maxTokens ?? config.maxTokens,
    top_p: params.topP ?? config.topP,
    frequency_penalty: params.frequencyPenalty ?? config.frequencyPenalty,
    presence_penalty: params.presencePenalty ?? config.presencePenalty,
    stop: params.stop ?? config.stop,
    seed: params.seed ?? config.seed,
    tool_choice: params.toolChoice ?? config.toolChoice,
    parallel_tool_calls: params.parallelToolCalls ?? config.parallelToolCalls,
    ...(params.signal ? { signal: params.signal } : {}),
    ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
    // vendor 透传兜底：最后展开，可覆盖同名归一化字段（调用方自行避免冲突）。
    ...(params.extra ?? config.extra ?? {}),
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
          reasoning: (message as unknown as { reasoning_content?: string } | undefined)
            ?.reasoning_content,
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
        finishReason: normalizeOpenAIFinishReason(choice?.finish_reason),
      };
    },

    async chatCompletionStream(
      params: ChatCompletionParams,
      onDelta: (delta: string, kind?: DeltaKind) => void,
    ): Promise<ChatCompletionResult> {
      const stream = await client.chat.completions.create({
        ...baseRequest(params),
        stream: true,
      });

      let content = '';
      let reasoning = '';
      let finishReason: FinishReason | undefined;
      const toolCalls = new StreamToolCallAccumulator();

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta as
          | { content?: string | null; reasoning_content?: string | null; tool_calls?: unknown[] }
          | undefined;
        if (delta?.reasoning_content) {
          reasoning += delta.reasoning_content;
          onDelta(delta.reasoning_content, 'reasoning');
        }
        if (delta?.content) {
          content += delta.content;
          onDelta(delta.content, 'content');
        }
        for (const part of (delta?.tool_calls ?? []) as {
          index: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }[]) {
          toolCalls.add(part.index, part);
        }
        if (choice?.finish_reason) {
          finishReason = normalizeOpenAIFinishReason(choice.finish_reason);
        }
      }

      return {
        message: {
          role: 'assistant',
          content,
          reasoning: reasoning || undefined,
          toolCalls: toolCalls.finalize().length > 0 ? toolCalls.finalize() : undefined,
        },
        finishReason,
      };
    },
  };
}
