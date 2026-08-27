import type { AgentConfig, DocumentsConfig, SecurityConfig } from '@agent-engine/config';
import { createEmbeddingProvider, resolveSandboxBackend } from '@agent-engine/core';
import type {
  LongTermMemory,
  LongTermMemoryFactoryDeps,
  PluginFactory,
  SandboxBackend,
} from '@agent-engine/core';
import { createBashPlugin } from '@agent-engine/plugin-bash';
import { createDocumentsPlugin } from '@agent-engine/plugin-documents';
import { createFilesPlugin } from '@agent-engine/plugin-files';
import { createGitPlugin } from '@agent-engine/plugin-git';
import { createGuardrailsPlugin } from '@agent-engine/plugin-guardrails';
import { createMcpPlugin } from '@agent-engine/plugin-mcp';
import { createSemanticMemory } from '@agent-engine/plugin-memory';
import { createRulesPlugin } from '@agent-engine/plugin-rules';
import { createSkillsPlugin, resolveSkills } from '@agent-engine/plugin-skills';
import { createWebPlugin } from '@agent-engine/plugin-web';

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

/** documents 的缺省空配置（config.documents 未声明时的 no-op 输入）。 */
const EMPTY_DOCUMENTS: DocumentsConfig = {
  sources: [],
  chunking: { strategy: 'heading', size: 1000, overlap: 0 },
  topK: 4,
};

/**
 * 构造默认全家桶的 plugin 工厂（闭包 `config` 切片）。
 * 覆盖 files / bash / git（安全工具，经 `config.plugins` 显式声明）与
 * rules / skills / documents / guardrails / web / mcp（能力，经 `defaultPlugins` 自动激活）。
 */
export function createPresetPluginFactories(config: AgentConfig): Record<string, PluginFactory> {
  const embedding = config.embedding ? createEmbeddingProvider(config.embedding) : undefined;
  const documents = config.documents ?? EMPTY_DOCUMENTS;

  return {
    '@agent-engine/plugin-files': () => createFilesPlugin(config.security.files),
    '@agent-engine/plugin-bash': () =>
      createBashPlugin(config.security.bash, resolveSandbox(config.security)),
    '@agent-engine/plugin-git': () => createGitPlugin({ sandbox: resolveSandbox(config.security) }),
    '@agent-engine/plugin-rules': () => createRulesPlugin(config.rules, { embedding }),
    '@agent-engine/plugin-skills': async () => {
      const { skills } = await resolveSkills(config.skills);
      return createSkillsPlugin(skills, { embedding });
    },
    '@agent-engine/plugin-documents': () => createDocumentsPlugin(documents, { embedding }),
    '@agent-engine/plugin-guardrails': () => createGuardrailsPlugin(config.guardrails),
    '@agent-engine/plugin-web': () => createWebPlugin(config.security),
    '@agent-engine/plugin-mcp': () => createMcpPlugin(config.mcp?.servers ?? []),
  };
}

/** 按 config 能力切片返回需自动装配的能力插件名（D1-A 零迁移）。 */
export function defaultCapabilityPlugins(config: AgentConfig): string[] {
  const names: string[] = [];
  if (config.rules.length > 0) names.push('@agent-engine/plugin-rules');
  if (config.skills.length > 0) names.push('@agent-engine/plugin-skills');
  if (config.documents && config.documents.sources.length > 0) {
    names.push('@agent-engine/plugin-documents');
  }
  if (config.guardrails.length > 0) names.push('@agent-engine/plugin-guardrails');
  if (config.mcp?.servers && config.mcp.servers.length > 0) {
    names.push('@agent-engine/plugin-mcp');
  }
  // web_search / web_fetch 是通用工具，恒激活。
  names.push('@agent-engine/plugin-web');
  return names;
}

/** 长期语义记忆工厂（用装配层解析出的后端创建 `SemanticMemory`）。 */
export function createPresetLongTermMemoryFactory() {
  return (deps: LongTermMemoryFactoryDeps): LongTermMemory =>
    createSemanticMemory(deps.vectorStore, deps.embedding, deps.memoryBackend);
}
