import type { FilePolicy } from '@agent-engine/config';
import { createReadFileTool, createWriteFileTool } from '@agent-engine/core';
import type { Plugin } from '@agent-engine/core';

/** 创建文件工具套件插件：注册 `read_file` / `write_file`（受 `files.roots` 约束）。 */
export function createFilesPlugin(policy: FilePolicy): Plugin {
  return {
    name: '@agent-engine/plugin-files',
    description: '本地文件读写工具（read_file / write_file），受 files.roots 约束',
    version: '0.1.0',
    install(ctx) {
      ctx.registerTool(createReadFileTool(policy));
      ctx.registerTool(createWriteFileTool(policy));
    },
  };
}
