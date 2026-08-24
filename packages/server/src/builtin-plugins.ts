import type { AgentConfig, SecurityConfig } from '@agent-engine/config';
import { resolveSandboxBackend } from '@agent-engine/core';
import type { PluginFactory, SandboxBackend } from '@agent-engine/core';
import { createBashPlugin } from '@agent-engine/plugin-bash';
import { createFilesPlugin } from '@agent-engine/plugin-files';
import { createGitPlugin } from '@agent-engine/plugin-git';

/** 解析沙箱后端；不可用则抛错（bash/git 绝不回退宿主进程裸奔）。 */
function resolveSandbox(security: SecurityConfig): SandboxBackend {
  const resolution = resolveSandboxBackend(security.sandbox.backend, {
    workspaceRoot: security.sandbox.workspaceRoot,
    image: security.sandbox.image,
    compact: security.sandbox.compact,
  });
  if (!resolution.available) {
    throw new Error(`sandbox unavailable: ${resolution.reason}`);
  }
  return resolution.backend;
}

/**
 * 构造内置 plugin 工厂（带 security/sandbox 上下文），供 server 注入 `resolveAgentConfig`。
 * files 无需沙箱；bash/git 需要沙箱，在 plugin 被声明加载时惰性解析。
 */
export function createBuiltinPluginFactories(config: AgentConfig): Record<string, PluginFactory> {
  return {
    '@agent-engine/plugin-files': () => createFilesPlugin(config.security.files),
    '@agent-engine/plugin-bash': () =>
      createBashPlugin(config.security.bash, resolveSandbox(config.security)),
    '@agent-engine/plugin-git': () => createGitPlugin({ sandbox: resolveSandbox(config.security) }),
  };
}
