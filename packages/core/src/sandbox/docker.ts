import type { SandboxBackend, SandboxBackendOptions, SandboxExecRequest } from './types';
import { runSandbox } from './run';

const DEFAULT_WORKDIR = '/workspace';

/**
 * 构建 `docker run` 参数（纯函数，便于单测锁定加固参数，无需真实执行）。
 * 加固：--rm / --network none / --read-only / --cap-drop ALL / --security-opt no-new-privileges / 非 root user / 资源限制。
 */
export function buildDockerArgs(req: SandboxExecRequest, options: SandboxBackendOptions): string[] {
  const args: string[] = ['run', '--rm'];

  args.push('--network', req.network === 'allowed' ? 'bridge' : 'none');
  args.push('--read-only');
  args.push('--cap-drop', 'ALL');
  args.push('--security-opt', 'no-new-privileges');

  const limits = req.limits ?? {};
  if (limits.pids !== undefined) args.push('--pids-limit', String(limits.pids));
  if (limits.memory) args.push('--memory', limits.memory);
  if (limits.cpu) args.push('--cpus', limits.cpu);

  args.push('--user', '1000:1000');
  args.push('--workdir', req.cwd ?? DEFAULT_WORKDIR);

  const root = options.workspaceRoot;
  if (root) args.push('-v', `${root}:${DEFAULT_WORKDIR}`);

  args.push(options.image ?? 'agent-engine/sandbox');

  const compact = req.compact ?? options.compact ?? false;
  if (compact) args.push('rtk');
  args.push(req.command);
  if (req.args && req.args.length > 0) args.push(...req.args);

  return args;
}

/** 创建 docker 沙箱后端。 */
export function createDockerSandbox(options: SandboxBackendOptions = {}): SandboxBackend {
  return {
    kind: 'docker',
    exec: (req) => runSandbox('docker', buildDockerArgs(req, options), req, options),
  };
}
