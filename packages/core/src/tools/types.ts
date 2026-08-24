import { z } from 'zod';

/**
 * 通用工具接口。`inputSchema` 用 Zod 定义，既用于运行时校验，也可转换为 JSON Schema 供 LLM 使用。
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  /** 工具唯一标识，LLM 通过该名字发起调用。 */
  name: string;
  /** 工具用途描述，供 LLM 理解何时调用。 */
  description: string;
  /** 入参 Zod schema，定义工具接受的参数结构。 */
  inputSchema: z.ZodType<TInput>;
  /**
   * 原生 JSON Schema（可选）。MCP 等外部工具已有现成 JSON Schema 时用它无损透传，
   * 供 LLM 使用；`ToolRegistry.toToolDefinition` 优先取它，否则回退 `toJSONSchema(inputSchema)`。
   */
  jsonSchema?: Record<string, unknown>;
  /** 执行工具，入参为经过 schema 校验后的强类型对象。 */
  execute(input: TInput): Promise<TOutput>;
}
