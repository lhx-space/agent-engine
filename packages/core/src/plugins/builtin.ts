import type { SecurityConfig } from '@agent-engine/config';
import { resolveSandboxBackend } from '../sandbox';
import type { SandboxBackend } from '../sandbox/types';
import { createBashTool } from '../tools/builtin/bash';
import { createReadFileTool, createWriteFileTool } from '../tools/builtin/file';
import type { Plugin } from './types';

/** 内置 plugin 工厂依赖：security 策略 + 预置沙箱后端（可选）。 */
export interface BuiltinPluginDeps {
  security: SecurityConfig;
  sandbox?: SandboxBackend;
}

export type BuiltinPluginFactory = (deps: BuiltinPluginDeps) => Plugin;

/** 创建文件工具套件 plugin：注册 `read_file` / `write_file`（roots 约束 + 越界阻断）。 */
export function createFilesPlugin(deps: BuiltinPluginDeps): Plugin {
  const policy = deps.security.files;
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

/** 创建命令执行 plugin：注册 `bash`（策略校验 + 沙箱执行，沙箱不可用即抛错绝不裸奔）。 */
export function createBashPlugin(deps: BuiltinPluginDeps): Plugin {
  const policy = deps.security.bash;
  return {
    name: '@agent-engine/plugin-bash',
    description: '沙箱命令执行（bash），受 allowCommands / denyPatterns / 网络开关约束',
    version: '0.1.0',
    install(ctx) {
      if (!policy.enabled) {
        throw new Error('bash plugin requires security.bash.enabled: true');
      }
      let sandbox = deps.sandbox;
      if (!sandbox) {
        const resolution = resolveSandboxBackend(deps.security.sandbox.backend, {
          workspaceRoot: deps.security.sandbox.workspaceRoot,
          image: deps.security.sandbox.image,
          compact: deps.security.sandbox.compact,
        });
        if (!resolution.available) {
          throw new Error(`bash enabled but no sandbox available: ${resolution.reason}`);
        }
        sandbox = resolution.backend;
      }
      ctx.registerTool(createBashTool(policy, sandbox));
    },
  };
}

/** 内置 plugin 工厂表（按 `config.plugins` 名字命中，无需 deps.pluginFactories 提供）。 */
export const builtinPluginFactories: Record<string, BuiltinPluginFactory> = {
  '@agent-engine/plugin-files': createFilesPlugin,
  '@agent-engine/plugin-bash': createBashPlugin,
};
