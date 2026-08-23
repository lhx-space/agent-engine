import { Parser } from 'expr-eval';
import { z } from 'zod';
import type { Tool } from '../types';

// ============ 类型 ============

/** calculator 入参。 */
export interface CalculatorInput {
  expression: string;
}

/** calculator 结果。 */
export interface CalculatorResult {
  result: number;
}

// ============ schema ============

const CalculatorInputSchema = z.object({ expression: z.string().min(1) });

// ============ 工具 ============

const parser = new Parser();

/** 创建 `calculator` 内置工具：经安全解析器（expr-eval）求值数学表达式，禁 eval。 */
export function createCalculatorTool(): Tool<CalculatorInput, CalculatorResult> {
  return {
    name: 'builtin.calculator',
    description: 'Evaluate a mathematical expression (e.g. "2 + 3 * 4") and return the number.',
    inputSchema: CalculatorInputSchema,
    execute: async ({ expression }) => {
      try {
        const result = parser.evaluate(expression);
        if (typeof result !== 'number' || !Number.isFinite(result)) {
          throw new Error('did not evaluate to a finite number');
        }
        return { result };
      } catch (error) {
        throw new Error(
          `Invalid expression: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
