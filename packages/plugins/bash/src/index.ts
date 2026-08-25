import type { BashPolicy } from '@agent-engine/config';
import { createBashTool } from '@agent-engine/core/tools';
import type { Plugin } from '@agent-engine/core/plugins';
import type { SandboxBackend } from '@agent-engine/core/sandbox';

/** 创建命令执行插件：注册 `bash`（策略校验 + 沙箱执行）；`bash.enabled` 未开启时抛错。 */
export function createBashPlugin(policy: BashPolicy, sandbox: SandboxBackend): Plugin {
  return {
    name: '@agent-engine/plugin-bash',
    description: '沙箱命令执行（bash），受 allowCommands / denyPatterns / 网络开关约束',
    version: '0.1.0',
    install(ctx) {
      if (!policy.enabled) {
        throw new Error('bash plugin requires security.bash.enabled: true');
      }
      ctx.registerTool(createBashTool(policy, sandbox));
    },
  };
}
