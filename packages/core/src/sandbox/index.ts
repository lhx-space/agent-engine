import { spawnSync } from 'node:child_process';
import type { SandboxBackendKind } from '@lhx-agent-engine/config';
import { createDockerSandbox } from './docker';
import { createNsJailSandbox } from './nsjail';
import type { ResolveSandboxDeps, SandboxBackendOptions, SandboxResolution } from './types';

export type {
  SandboxBackend,
  SandboxBackendOptions,
  SandboxExecRequest,
  SandboxExecResult,
  SandboxResolution,
  ResolveSandboxDeps,
} from './types';
export { SandboxUnavailableError } from './types';
export { buildDockerArgs, createDockerSandbox } from './docker';
export { buildNsJailArgs, createNsJailSandbox } from './nsjail';
export { WasiFunctionSandbox } from './function';
export type {
  FunctionSandbox,
  FunctionSandboxExecRequest,
  FunctionSandboxExecResult,
} from './function';

function defaultHasBinary(bin: string): boolean {
  const result = spawnSync(bin, ['--version'], { stdio: 'ignore' });
  return result.error === undefined;
}

/**
 * 解析沙箱后端：显式 docker / nsjail 优先；auto 按 docker 可用 → Linux 且 nsjail 可用 → 不可用 的顺序降级。
 * 不可用时返回 { available: false }（上层据此禁用 bash，绝不裸奔）。
 */
export function resolveSandboxBackend(
  kind: SandboxBackendKind,
  options: SandboxBackendOptions = {},
  deps: ResolveSandboxDeps = {},
): SandboxResolution {
  const hasBinary = deps.hasBinary ?? defaultHasBinary;
  const platform = deps.platform ?? process.platform;

  if (kind === 'docker') {
    return hasBinary('docker')
      ? { available: true, backend: createDockerSandbox(options) }
      : { available: false, reason: 'docker binary not found' };
  }

  if (kind === 'nsjail') {
    return hasBinary('nsjail')
      ? { available: true, backend: createNsJailSandbox(options) }
      : { available: false, reason: 'nsjail binary not found' };
  }

  // auto
  if (hasBinary('docker')) return { available: true, backend: createDockerSandbox(options) };
  if (platform === 'linux' && hasBinary('nsjail')) {
    return { available: true, backend: createNsJailSandbox(options) };
  }
  return { available: false, reason: 'no sandbox backend available (docker / nsjail)' };
}
