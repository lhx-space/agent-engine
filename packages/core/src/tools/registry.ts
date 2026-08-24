import { toJSONSchema } from 'zod';
import type { ToolDefinition } from '../llm/types';
import type { Tool } from './types';

/**
 * 工具注册表：管理工具实例，负责工具调用的参数解析、校验与执行。
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /** 注册工具。同名注册时后者覆盖前者。 */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /** 按名移除工具。已注册返回 true，未注册返回 false 且无副作用。 */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /** 按名查询工具，未注册返回 undefined。 */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** 判断工具是否已注册。 */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** 列出全部已注册工具。 */
  list(): Tool[] {
    return [...this.tools.values()];
  }

  /**
   * 执行工具。入参为 JSON 字符串（LLM 返回的 function.arguments）。
   * 内部依次：JSON.parse → inputSchema 校验 → Tool.execute。
   */
  async execute(name: string, argsJson: string): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(argsJson);
    } catch (error) {
      throw new Error(
        `Tool "${name}" received invalid JSON arguments: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }

    const result = tool.inputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Tool "${name}" received invalid arguments: ${result.error.message}`, {
        cause: result.error,
      });
    }

    return tool.execute(result.data);
  }

  /** 将单个工具转换为 LLM 可用的 ToolDefinition。 */
  toToolDefinition(tool: Tool): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: (tool.jsonSchema ?? toJSONSchema(tool.inputSchema)) as Record<string, unknown>,
      },
    };
  }

  /** 将全部已注册工具转换为 LLM 可用的 ToolDefinition 数组。 */
  toToolDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => this.toToolDefinition(tool));
  }
}
