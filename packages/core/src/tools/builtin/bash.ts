import { z } from 'zod';
import type { BashPolicy } from '@agent-engine/config';
import type { SandboxBackend, SandboxExecResult } from '../../sandbox/types';
import type { Tool } from '../types';
import { checkBashPolicy } from '../utils/bash-policy';

// ============ 类型 ============

/** bash 入参。 */
export interface BashInput {
  command: string;
  args: string[];
}

// ============ schema ============

const BashInputSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
});

// ============ 工具 ============

/** 创建 `bash` 内置工具：策略校验（白/黑名单 + 网络开关）通过后经 SandboxBackend 沙箱执行。 */
export function createBashTool(
  policy: BashPolicy,
  sandbox: SandboxBackend,
): Tool<BashInput, SandboxExecResult> {
  return {
    name: 'builtin.bash',
    description:
      'Execute a shell command inside a sandboxed environment. Only allowed commands run; dangerous patterns are blocked.',
    inputSchema: BashInputSchema,
    execute: async ({ command, args }) => {
      if (!policy.enabled) throw new Error('bash tool is disabled');
      const denied = checkBashPolicy(policy, command, args);
      if (denied) throw new Error(`Blocked: ${denied}`);
      return sandbox.exec({
        command,
        args,
        timeoutMs: policy.timeoutMs,
        maxOutputBytes: policy.maxOutputBytes,
        network: policy.allowNetwork ? 'allowed' : 'none',
      });
    },
  };
}
