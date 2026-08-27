import type { Tool } from '../tools/types';

/** 外部工具来源（如 MCP）：`resolve` 出归一化工具与释放句柄（连接失败由实现内部隔离）。 */
export interface ToolSource {
  readonly name: string;
  resolve(): Promise<{ tools: Tool[]; dispose(): Promise<void> }>;
}
