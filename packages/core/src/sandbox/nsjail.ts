import type { SandboxBackend, SandboxBackendOptions, SandboxExecRequest } from './types';
import { runSandbox } from './run';

const DEFAULT_WORKDIR = '/workspace';

/**
 * 构建 `nsjail` 参数（纯函数，便于单测锁定加固参数，无需真实执行；Linux 专用）。
 * 加固：-Mo（单次执行）/ --timeout / --rlimit_as / --rlimit_cpu / 非 root user / workspace 挂载 / 默认网络隔离。
 */
export function buildNsJailArgs(req: SandboxExecRequest, options: SandboxBackendOptions): string[] {
  const timeoutMs = req.timeoutMs ?? options.timeoutMs ?? 30_000;
  const args: string[] = ['-Mo'];

  args.push('--timeout', String(Math.ceil(timeoutMs / 1000)));

  const limits = req.limits ?? {};
  if (limits.memory) args.push('--rlimit_as', limits.memory);
  if (limits.cpu) args.push('--rlimit_cpu', limits.cpu);

  args.push('--user', '1000:1000');

  const root = options.workspaceRoot;
  if (root) args.push('--bindmount', `${root}:${DEFAULT_WORKDIR}`);

  args.push('--cwd', req.cwd ?? DEFAULT_WORKDIR);

  // nsjail 默认创建独立 netns（无网络）；--net 共享宿主网络即开放。
  if (req.network === 'allowed') args.push('--net');

  args.push('--');

  const compact = req.compact ?? options.compact ?? false;
  if (compact) args.push('rtk');
  args.push(req.command);
  if (req.args && req.args.length > 0) args.push(...req.args);

  return args;
}

/** 创建 nsjail 沙箱后端（Linux）。 */
export function createNsJailSandbox(options: SandboxBackendOptions = {}): SandboxBackend {
  return {
    kind: 'nsjail',
    exec: (req) => runSandbox('nsjail', buildNsJailArgs(req, options), req, options),
  };
}
