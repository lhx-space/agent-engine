import type { FilePolicy } from '@lhx-agent-engine/config';
import {
  createListFilesTool,
  createReadFileTool,
  createWriteFileTool,
} from '@lhx-agent-engine/core/tools';
import type { Plugin } from '@lhx-agent-engine/core/plugins';

/** 创建文件工具套件插件：注册 `read_file` / `write_file` / `list_files`（受 `files.roots` 约束）。 */
export function createFilesPlugin(policy: FilePolicy): Plugin {
  return {
    name: '@lhx-agent-engine/plugin-files',
    description: '本地文件工具（read_file / write_file / list_files），受 files.roots 约束',
    version: '0.1.0',
    install(ctx) {
      ctx.registerTool(createReadFileTool(policy));
      ctx.registerTool(createWriteFileTool(policy));
      ctx.registerTool(createListFilesTool(policy));
    },
  };
}
