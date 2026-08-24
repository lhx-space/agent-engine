import { toJSONSchema } from 'zod';
import type { ToolDefinition } from '../llm/types';
import type { Tool } from './types';

/**
 * LLM 对工具 function.name 的硬约束：只允许字母/数字/下划线/连字符（不允许点号等）。
 * 配置语义名（如 `builtin.read_file`）带点号，不能直接发给 LLM，需转成合法名。
 */
const LLM_NAME_INVALID = /[^a-zA-Z0-9_-]/g;

/** 把工具语义名转成 LLM 合法的 function.name（非法字符替换为 `_`）。 */
export function toLlmName(name: string): string {
  return name.replace(LLM_NAME_INVALID, '_');
}

/**
 * 把 LLM 返回的工具入参规范化为合法 JSON 字符串：空 / 空白 / 无法解析 → `'{}'`。
 * 保证回填历史的消息入参始终合法（否则下一轮服务端 JSON.parse 会崩）。
 */
export function normalizeToolArgs(args: string | undefined): string {
  const trimmed = (args ?? '').trim();
  if (trimmed === '') return '{}';
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    return '{}';
  }
}

/**
 * 工具注册表：管理工具实例，负责工具调用的参数解析、校验与执行。
 * 内部维护「LLM 名 → 语义名」反向映射，LLM 回调时反查真实工具名。
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  private readonly llmNames = new Map<string, string>();

  /** 注册工具。同名注册时后者覆盖前者。 */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.llmNames.set(toLlmName(tool.name), tool.name);
  }

  /** 按名移除工具。已注册返回 true，未注册返回 false 且无副作用。 */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.llmNames.delete(toLlmName(name));
    }
    return removed;
  }

  /** LLM 回调名 → 真实语义名（未注册时原样返回，保证向后兼容）。 */
  resolveName(llmName: string): string {
    return this.llmNames.get(llmName) ?? llmName;
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
      parsed = JSON.parse(normalizeToolArgs(argsJson));
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

  /** 将单个工具转换为 LLM 可用的 ToolDefinition（function.name 转成 LLM 合法名）。 */
  toToolDefinition(tool: Tool): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: toLlmName(tool.name),
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
