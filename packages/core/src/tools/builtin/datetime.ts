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

/**
 * 完整输出（星期 + 日期 + 时分秒）的本地化渲染；未提供 locale/timeZone 时用系统默认时区。
 */
function formatDate(date: Date, locale?: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(
    locale,
    timeZone
      ? { timeZone, dateStyle: 'full', timeStyle: 'long' }
      : { dateStyle: 'full', timeStyle: 'long' },
  ).format(date);
}

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
          const result: DatetimeResult = { iso: now.toISOString(), epochMs: now.getTime() };
          // 提供 timeZone/locale 时直接返回本地化完整串，模型一次调用即可答「现在几点/星期几」。
          if (input.timeZone || input.locale) {
            result.formatted = formatDate(now, input.locale, input.timeZone);
          }
          return result;
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
          // 完整输出（星期 + 日期 + 时分秒），避免模型反复追问「星期几 / 几点」。
          const formatted = formatDate(date, input.locale, input.timeZone);
          return { iso: date.toISOString(), epochMs: date.getTime(), formatted };
        }
      }
    },
  };
}
