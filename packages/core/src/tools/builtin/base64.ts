import { z } from 'zod';
import type { Tool } from '../types';

// ============ 类型 ============

/** base64 入参。 */
export interface Base64Input {
  action: 'encode' | 'decode';
  input: string;
}

/** base64 结果。 */
export type Base64Result = { encoded: string } | { decoded: string };

// ============ schema ============

const Base64InputSchema = z.object({
  action: z.enum(['encode', 'decode']),
  input: z.string(),
});

// ============ 工具 ============

/** 创建 `base64` 内置工具：encode（编码）/ decode（解码），基于 Node Buffer。 */
export function createBase64Tool(): Tool<Base64Input, Base64Result> {
  return {
    name: 'builtin.base64',
    description: 'Base64 encode or decode text.',
    inputSchema: Base64InputSchema,
    execute: async ({ action, input }) => {
      if (action === 'encode') {
        return { encoded: Buffer.from(input, 'utf8').toString('base64') };
      }
      return { decoded: Buffer.from(input, 'base64').toString('utf8') };
    },
  };
}
