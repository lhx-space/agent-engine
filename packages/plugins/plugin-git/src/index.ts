import { z } from 'zod';
import type { Plugin } from '@lhx-agent-engine/core/plugins';
import type { SandboxBackend } from '@lhx-agent-engine/core/sandbox';
import type { Tool } from '@lhx-agent-engine/core/tools';

// ============ 类型 ============

/** git 策略：只读子命令白名单 + 破坏性子命令黑名单。 */
export interface GitPolicy {
  /** 允许的子命令白名单（空 = 不启用白名单，仅黑名单生效）。 */
  allowCommands: string[];
  /** 破坏性子命令黑名单（命中即阻断）。 */
  denyCommands: string[];
}

/** git plugin 工厂选项。 */
export interface GitPluginOptions {
  /** 沙箱后端（git 命令经其隔离执行）。 */
  sandbox: SandboxBackend;
  /** 子命令策略；缺省为只读白名单 + 破坏性黑名单。 */
  policy?: GitPolicy;
  /** 是否经 rtk 压缩输出（默认 true；需沙箱镜像安装 rtk）。 */
  compact?: boolean;
}

/** git 工具入参。 */
export interface GitInput {
  args: string[];
}

// ============ 常量 ============

const DEFAULT_ALLOW_COMMANDS = [
  'status',
  'diff',
  'log',
  'show',
  'branch',
  'remote',
  'rev-parse',
  'ls-files',
  'blame',
];

const DEFAULT_DENY_COMMANDS = [
  'commit',
  'push',
  'pull',
  'checkout',
  'reset',
  'clean',
  'merge',
  'rebase',
  'rm',
  'mv',
  'tag',
  'cherry-pick',
  'stash',
  'switch',
  'restore',
];

// ============ schema ============

const GitInputSchema = z.object({ args: z.array(z.string()).min(1) });

// ============ plugin ============

/**
 * 创建 git 工具套件插件：注册单个 `git` 工具（`args` 为 git 命令参数），
 * 默认只读子命令，破坏性子命令阻断；经 SandboxBackend 隔离执行并 rtk 压缩输出。
 */
export function createGitPlugin(options: GitPluginOptions): Plugin {
  const policy = options.policy ?? {
    allowCommands: DEFAULT_ALLOW_COMMANDS,
    denyCommands: DEFAULT_DENY_COMMANDS,
  };
  const compact = options.compact ?? true;

  const gitTool: Tool<GitInput, unknown> = {
    name: 'git',
    description:
      'Run a git command. Read-only subcommands (status/diff/log/show/branch/...) are allowed; destructive subcommands (commit/push/checkout/...) are blocked.',
    inputSchema: GitInputSchema,
    execute: async ({ args }) => {
      const subcommand = args[0];
      if (!subcommand) throw new Error('git requires a subcommand');
      if (policy.denyCommands.includes(subcommand)) {
        throw new Error(`Blocked: git subcommand "${subcommand}" is not allowed`);
      }
      if (policy.allowCommands.length > 0 && !policy.allowCommands.includes(subcommand)) {
        throw new Error(`Blocked: git subcommand "${subcommand}" is not in allowCommands`);
      }
      return options.sandbox.exec({ command: 'git', args, compact });
    },
  };

  return {
    name: '@lhx-agent-engine/plugin-git',
    description: 'Git 工具套件（只读默认，破坏性子命令阻断，经沙箱执行）',
    version: '0.1.0',
    tags: ['git', 'vcs', '版本控制'],
    install(ctx) {
      ctx.registerTool(gitTool);
    },
  };
}
