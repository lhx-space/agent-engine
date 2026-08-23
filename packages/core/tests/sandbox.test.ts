import { describe, expect, it } from '@rstest/core';
import { buildDockerArgs, buildNsJailArgs, resolveSandboxBackend } from '../src/sandbox';

describe('buildDockerArgs', () => {
  it('默认加固参数', () => {
    const args = buildDockerArgs({ command: 'echo', args: ['hi'] }, {});

    expect(args).toContain('--rm');
    expect(args[args.indexOf('--network') + 1]).toBe('none');
    expect(args).toContain('--read-only');
    expect(args).toContain('--cap-drop');
    expect(args).toContain('ALL');
    expect(args).toContain('--security-opt');
    expect(args).toContain('no-new-privileges');
    expect(args[args.indexOf('--user') + 1]).toBe('1000:1000');
    expect(args).toContain('agent-engine/sandbox');
    expect(args).toContain('echo');
    expect(args).toContain('hi');
  });

  it('network allowed 切换为 bridge', () => {
    const args = buildDockerArgs({ command: 'echo', network: 'allowed' }, {});
    expect(args[args.indexOf('--network') + 1]).toBe('bridge');
  });

  it('workspaceRoot 挂载', () => {
    const args = buildDockerArgs({ command: 'echo' }, { workspaceRoot: '/tmp/ws' });
    expect(args).toContain('/tmp/ws:/workspace');
  });

  it('资源限制参数', () => {
    const args = buildDockerArgs(
      { command: 'echo', limits: { pids: 64, memory: '256m', cpu: '0.5' } },
      {},
    );
    expect(args[args.indexOf('--pids-limit') + 1]).toBe('64');
    expect(args[args.indexOf('--memory') + 1]).toBe('256m');
    expect(args[args.indexOf('--cpus') + 1]).toBe('0.5');
  });

  it('compact 时 rtk 包装', () => {
    const args = buildDockerArgs({ command: 'git', args: ['status'], compact: true }, {});
    const imageIdx = args.indexOf('agent-engine/sandbox');
    expect(args[imageIdx + 1]).toBe('rtk');
    expect(args[imageIdx + 2]).toBe('git');
    expect(args[imageIdx + 3]).toBe('status');
  });

  it('默认不包装 rtk', () => {
    const args = buildDockerArgs({ command: 'git', args: ['status'] }, {});
    const imageIdx = args.indexOf('agent-engine/sandbox');
    expect(args[imageIdx + 1]).toBe('git');
  });
});

describe('buildNsJailArgs', () => {
  it('默认加固参数', () => {
    const args = buildNsJailArgs({ command: 'echo' }, { workspaceRoot: '/tmp/ws' });

    expect(args[0]).toBe('-Mo');
    expect(args).toContain('--timeout');
    expect(args[args.indexOf('--user') + 1]).toBe('1000:1000');
    expect(args).toContain('/tmp/ws:/workspace');
    expect(args).toContain('--cwd');

    const sep = args.indexOf('--');
    expect(sep).toBeGreaterThan(0);
    expect(args[sep + 1]).toBe('echo');
  });

  it('network allowed 加 --net', () => {
    const args = buildNsJailArgs({ command: 'echo', network: 'allowed' }, {});
    expect(args).toContain('--net');
  });

  it('compact 时 rtk 包装', () => {
    const args = buildNsJailArgs({ command: 'git', args: ['status'], compact: true }, {});
    const sep = args.indexOf('--');
    expect(args[sep + 1]).toBe('rtk');
    expect(args[sep + 2]).toBe('git');
    expect(args[sep + 3]).toBe('status');
  });
});

describe('resolveSandboxBackend', () => {
  it('显式 docker 且可用', () => {
    const res = resolveSandboxBackend('docker', {}, { hasBinary: (bin) => bin === 'docker' });
    expect(res.available).toBe(true);
    if (res.available) expect(res.backend.kind).toBe('docker');
  });

  it('显式 docker 不可用', () => {
    const res = resolveSandboxBackend('docker', {}, { hasBinary: () => false });
    expect(res.available).toBe(false);
  });

  it('auto 优先 docker', () => {
    const res = resolveSandboxBackend(
      'auto',
      {},
      { hasBinary: (bin) => bin === 'docker', platform: 'linux' },
    );
    expect(res.available).toBe(true);
    if (res.available) expect(res.backend.kind).toBe('docker');
  });

  it('auto 在 Linux 无 docker 落到 nsjail', () => {
    const res = resolveSandboxBackend(
      'auto',
      {},
      { hasBinary: (bin) => bin === 'nsjail', platform: 'linux' },
    );
    expect(res.available).toBe(true);
    if (res.available) expect(res.backend.kind).toBe('nsjail');
  });

  it('auto 在非 Linux 无 docker 不可用', () => {
    const res = resolveSandboxBackend(
      'auto',
      {},
      { hasBinary: (bin) => bin === 'nsjail', platform: 'darwin' },
    );
    expect(res.available).toBe(false);
  });

  it('auto 全无不可用并给原因', () => {
    const res = resolveSandboxBackend('auto', {}, { hasBinary: () => false, platform: 'linux' });
    expect(res.available).toBe(false);
    if (!res.available) expect(res.reason).toMatch(/no sandbox backend/);
  });
});
