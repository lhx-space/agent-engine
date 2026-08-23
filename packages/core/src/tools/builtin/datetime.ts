import { z } from 'zod';
import type { Tool } from '../types';

// ============ 类型 ============

/** datetime 入参。 */
export interface DatetimeInput {
  action: 'now' | 'format' | 'parse';
  value?: string;
  locale?: string;
  timeZone?: string;
}

/** datetime 结果。 */
export interface DatetimeResult {
  iso: string;
  epochMs: number;
  formatted?: string;
}

// ============ schema ============

const DatetimeInputSchema = z.object({
  action: z.enum(['now', 'format', 'parse']),
  value: z.string().optional(),
  locale: z.string().optional(),
  timeZone: z.string().optional(),
});

// ============ 工具 ============

/** 创建 `datetime` 内置工具：now（当前时间）/ format（时间戳格式化）/ parse（字符串解析）。 */
export function createDatetimeTool(): Tool<DatetimeInput, DatetimeResult> {
  return {
    name: 'builtin.datetime',
    description:
      'Date/time utilities. Actions: now (current time), format (timestamp -> localized string), parse (string -> timestamp).',
    inputSchema: DatetimeInputSchema,
    execute: async (input) => {
      switch (input.action) {
        case 'now': {
          const now = new Date();
          return { iso: now.toISOString(), epochMs: now.getTime() };
        }
        case 'parse': {
          if (!input.value) throw new Error('datetime parse requires "value"');
          const date = new Date(input.value);
          if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: "${input.value}"`);
          return { iso: date.toISOString(), epochMs: date.getTime() };
        }
        case 'format': {
          if (!input.value) throw new Error('datetime format requires "value"');
          const date = new Date(input.value);
          if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: "${input.value}"`);
          const formatted = new Intl.DateTimeFormat(
            input.locale,
            input.timeZone ? { timeZone: input.timeZone } : undefined,
          ).format(date);
          return { iso: date.toISOString(), epochMs: date.getTime(), formatted };
        }
      }
    },
  };
}
