import { toJSONSchema } from 'zod';
import type { z } from 'zod';
import type { ChatMessage, LLMProvider } from '../llm/types';

/** `extractStructured` 的入参。 */
export interface ExtractStructuredInput<Schema extends z.ZodType> {
  provider: LLMProvider;
  /** 目标结构（Zod schema）；返回类型由 `z.infer` 推导。 */
  schema: Schema;
  /** 用户上下文消息（不含 system；system 指令由本函数注入）。 */
  messages: ChatMessage[];
  /** 覆盖默认 system 指令（默认注入「仅输出符合 JSON Schema 的 JSON」）。 */
  system?: string;
  /** 校验失败重试次数（默认 2；共 maxRetries + 1 次尝试）。 */
  maxRetries?: number;
}

const DEFAULT_MAX_RETRIES = 2;

/**
 * 结构化输出原语（对齐 RIG Extractors）：驱动 LLM 产出符合 `schema` 的 JSON，
 * 解析并校验为强类型值；失败把错误回填为 follow-up 消息后重试。
 */
export async function extractStructured<Schema extends z.ZodType>(
  input: ExtractStructuredInput<Schema>,
): Promise<z.infer<Schema>> {
  const { provider, schema, messages, system, maxRetries = DEFAULT_MAX_RETRIES } = input;

  const jsonSchema = JSON.stringify(toJSONSchema(schema));
  const conversation: ChatMessage[] = [
    {
      role: 'system',
      content:
        system ??
        `Respond with a single valid JSON object matching this JSON Schema:\n${jsonSchema}\nRespond with only the JSON — no markdown fences, no commentary.`,
    },
    ...messages,
  ];

  let lastError = '';
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const result = await provider.chatCompletion({
      messages: conversation,
      responseFormat: { type: 'json_object' },
    });
    const content = result.message.content;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      lastError = `invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
      conversation.push(
        { role: 'assistant', content },
        {
          role: 'user',
          content: `Your previous response was not valid JSON (${lastError}). Reply with valid JSON only.`,
        },
      );
      continue;
    }

    const validated = schema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    lastError = validated.error.message;
    conversation.push(
      { role: 'assistant', content },
      {
        role: 'user',
        content: `Your previous response did not match the schema. Fix it:\n${lastError}`,
      },
    );
  }

  throw new Error(`extractStructured failed after ${maxRetries + 1} attempt(s): ${lastError}`);
}
