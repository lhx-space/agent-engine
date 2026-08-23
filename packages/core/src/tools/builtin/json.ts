import { z } from 'zod';
import type { Tool } from '../types';

// ============ 类型 ============

/** json 入参。 */
export interface JsonInput {
  action: 'parse' | 'stringify';
  input?: string;
  value?: unknown;
}

/** json 结果。 */
export type JsonResult = { value: unknown } | { json: string };

// ============ schema ============

const JsonInputSchema = z.object({
  action: z.enum(['parse', 'stringify']),
  input: z.string().optional(),
  value: z.unknown().optional(),
});

// ============ 工具 ============

/** 创建 `json` 内置工具：parse（解析并校验 JSON）/ stringify（序列化为 JSON 字符串）。 */
export function createJsonTool(): Tool<JsonInput, JsonResult> {
  return {
    name: 'builtin.json',
    description:
      'JSON utilities. Actions: parse (string -> value), stringify (value -> JSON string).',
    inputSchema: JsonInputSchema,
    execute: async (input) => {
      switch (input.action) {
        case 'parse': {
          if (typeof input.input !== 'string')
            throw new Error('json parse requires "input" string');
          try {
            return { value: JSON.parse(input.input) };
          } catch (error) {
            throw new Error(
              `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        case 'stringify':
          return { json: JSON.stringify(input.value ?? null) };
      }
    },
  };
}
