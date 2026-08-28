import Anthropic from '@anthropic-ai/sdk';
import type { BaseModelConfig } from '@lhx-agent-engine/config';
import {
  AbortError,
  type ChatCompletionParams,
  type ChatCompletionResult,
  type ChatMessage,
  type FinishReason,
  type LLMProvider,
  type ToolCall,
  type ToolChoice,
  type ToolDefinition,
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

/**
 * 把消息序列转成 Anthropic 消息。
 * 关键：连续的 `tool` 消息必须合并进「同一个 user 消息」（多个 `tool_result` block），
 * 否则 Anthropic 会报「tool_use 后紧跟的消息缺少对应 tool_result」。
 */
function buildAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];
  let pendingToolResults: AnthropicContentBlock[] = [];

  const flushToolResults = (): void => {
    if (pendingToolResults.length > 0) {
      result.push({ role: 'user', content: pendingToolResults });
      pendingToolResults = [];
    }
  };

  for (const message of messages) {
    if (message.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: message.toolCallId ?? '',
        content: message.content,
      });
    } else {
      flushToolResults();
      result.push(toAnthropicMessage(message));
    }
  }
  flushToolResults();
  return result;
}

/** anthropic `stop_reason` → 归一化 `FinishReason`。 */
function normalizeAnthropicStopReason(reason: string | null | undefined): FinishReason | undefined {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    case null:
    case undefined:
      return undefined;
    default:
      return 'unknown';
  }
}

/** openai-compatible `ToolChoice` 语义 → anthropic `tool_choice`（auto/any/tool/none）。 */
function mapToolChoice(choice: ToolChoice | undefined): Anthropic.ToolChoice | undefined {
  if (choice === undefined) return undefined;
  if (choice === 'auto') return { type: 'auto' };
  if (choice === 'none') return { type: 'none' };
  if (choice === 'required') return { type: 'any' };
  return { type: 'tool', name: choice.function.name };
}

export function createAnthropicProvider(config: BaseModelConfig): LLMProvider {
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

    const messages = buildAnthropicMessages(params.messages.filter((m) => m.role !== 'system'));
    // anthropic 协议支持 temperature / top_p / max_tokens / stop_sequences / tool_choice；
    // 其余（frequency/presence/seed/parallel_tool_calls/response_format）静默忽略。
    // stop_sequences 仅当非空数组才透传（anthropic 拒绝空数组）。
    const stopSequences = params.stop ?? config.stop;
    const toolChoice = mapToolChoice(params.toolChoice ?? config.toolChoice);

    return {
      model: config.model,
      max_tokens: params.maxTokens ?? config.maxTokens ?? 4096,
      system: system || undefined,
      messages,
      tools: params.tools?.map(toAnthropicTool),
      temperature: params.temperature ?? config.temperature,
      top_p: params.topP ?? config.topP,
      ...(stopSequences && stopSequences.length > 0 ? { stop_sequences: stopSequences } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      // vendor 透传兜底：最后展开，可覆盖同名归一化字段（调用方自行避免冲突）。
      ...(params.extra ?? config.extra ?? {}),
    };
  };

  return {
    name: 'anthropic',
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      if (params.signal?.aborted) throw new AbortError();
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
        finishReason: normalizeAnthropicStopReason(response.stop_reason),
      };
    },

    async chatCompletionStream(
      params: ChatCompletionParams,
      onDelta: (delta: string) => void,
    ): Promise<ChatCompletionResult> {
      if (params.signal?.aborted) throw new AbortError();
      const stream = await client.messages.create({ ...buildRequest(params), stream: true });

      let text = '';
      let finishReason: FinishReason | undefined;
      // 流式下 tool_use 的 input 是分片 JSON，按 content_block index 累积（key 对齐 block index）。
      const toolCalls = new Map<number, ToolCall>();
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
            toolCalls.set(event.index, {
              id: event.content_block.id,
              type: 'function',
              function: {
                name: event.content_block.name,
                arguments: '',
              },
            });
          }
        } else if (event.type === 'message_delta') {
          finishReason = normalizeAnthropicStopReason(event.delta.stop_reason) ?? finishReason;
        }
      }

      // 流结束后把累积的分片 JSON 回填到对应 tool_use（按 block index 对齐，避免 text block 占位错位）。
      for (const [index, json] of toolInputJson) {
        const call = toolCalls.get(index);
        if (call) {
          call.function.arguments = json;
        }
      }

      const orderedToolCalls = [...toolCalls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, call]) => call);

      return {
        message: {
          role: 'assistant',
          content: text,
          toolCalls: orderedToolCalls.length > 0 ? orderedToolCalls : undefined,
        },
        finishReason,
      };
    },
  };
}
