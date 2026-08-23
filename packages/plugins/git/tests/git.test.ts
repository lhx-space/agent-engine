import { describe, expect, it } from '@rstest/core';
import type {
  Plugin,
  PluginContext,
  SandboxBackend,
  SandboxExecRequest,
  Tool,
} from '@agent-engine/core';
import { createGitPlugin } from '../src/index';

function makeCtx(): { ctx: PluginContext; tools: Tool[] } {
  const tools: Tool[] = [];
  const ctx: PluginContext = {
    registerTool: (tool) => tools.push(tool),
    registerSkill: () => {},
    registerHook: () => {},
    registerRule: () => {},
    provideSystemPrompt: () => {},
  };
  return { ctx, tools };
}

const noopSandbox: SandboxBackend = {
  kind: 'docker',
  exec: async () => ({ exitCode: 0, stdout: '', stderr: '', truncated: false }),
};

describe('git plugin', () => {
  it('安装后注册 git 工具', async () => {
    const { ctx, tools } = makeCtx();
    await createGitPlugin({ sandbox: noopSandbox }).install(ctx);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('git');
  });

  it('只读命令经沙箱执行且 compact', async () => {
    let captured: SandboxExecRequest | undefined;
    const sandbox: SandboxBackend = {
      kind: 'docker',
      exec: async (req) => {
        captured = req;
        return { exitCode: 0, stdout: '', stderr: '', truncated: false };
      },
    };
    const { ctx, tools } = makeCtx();
    await createGitPlugin({ sandbox }).install(ctx);
    await tools[0]!.execute({ args: ['status'] });
    expect(captured).toMatchObject({ command: 'git', args: ['status'], compact: true });
  });

  it('破坏性命令阻断', async () => {
    const { ctx, tools } = makeCtx();
    await createGitPlugin({ sandbox: noopSandbox }).install(ctx);
    await expect(tools[0]!.execute({ args: ['push'] })).rejects.toThrow(/Blocked/);
  });

  it('未知子命令被白名单拒绝', async () => {
    const { ctx, tools } = makeCtx();
    await createGitPlugin({ sandbox: noopSandbox }).install(ctx);
    await expect(tools[0]!.execute({ args: ['foobar'] })).rejects.toThrow(/allowCommands/);
  });
});
