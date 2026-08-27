import { describe, expect, it } from '@rstest/core';
import type { BashPolicy } from '@agent-engine/config';
import { PluginManager } from '@agent-engine/core';
import type { SandboxBackend } from '@agent-engine/core';
import { createBashPlugin } from '../src/index';

function makeBashPolicy(overrides: Partial<BashPolicy> = {}): BashPolicy {
  return {
    enabled: true,
    allowCommands: [],
    denyPatterns: [],
    allowNetwork: false,
    timeoutMs: 1000,
    maxOutputBytes: 1024,
    ...overrides,
  };
}

const fakeSandbox: SandboxBackend = {
  kind: 'docker',
  exec: async () => ({ exitCode: 0, stdout: '', stderr: '', truncated: false }),
};

describe('createBashPlugin', () => {
  it('注册 bash', async () => {
    const manager = new PluginManager();
    await manager.install(createBashPlugin(makeBashPolicy(), fakeSandbox));

    const names = manager.getAssembly().tools.map((tool) => tool.name);
    expect(names).toContain('builtin.bash');
  });

  it('bash.enabled 未开启时抛错', async () => {
    const manager = new PluginManager();
    await expect(
      manager.install(createBashPlugin(makeBashPolicy({ enabled: false }), fakeSandbox)),
    ).rejects.toThrow(/security\.bash\.enabled/);
  });
});
