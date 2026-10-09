import type { AgentConfig } from '@lhx-agent-engine/config';
import { resolveAgentConfig } from '@lhx-agent-engine/core';
import type { AgentBundle } from './agents-repo';
import { toRunnableConfig } from './agents-repo';
import {
  createPresetLongTermMemoryFactory,
  createPresetPluginFactories,
  defaultCapabilityPlugins,
} from '@lhx-agent-engine/preset-default';

export interface RunAgentResult {
  sessionId: string;
  persisted: boolean;
  finalText: string;
}

/**
 * 把平台侧的知识库文档落到临时目录，并把路径写进 `documents.sources`
 * （documents 插件按文件路径装载，平台侧文档正文存在库里，故运行时需物化一次）。
 */
async function materializeDocuments(
  agentId: string,
  docs: { name: string; content: string }[],
): Promise<string[]> {
  if (docs.length === 0) return [];
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = join(tmpdir(), 'agent-engine-platform', agentId);
  await mkdir(dir, { recursive: true });
  const paths: string[] = [];
  for (const doc of docs) {
    const target = join(dir, doc.name);
    await writeFile(target, doc.content, 'utf-8');
    paths.push(target);
  }
  return paths;
}

/** 把实例 bundle 变成可运行的 `AgentConfig`（子表折叠 + 文档物化）。 */
async function toRunnable(bundle: AgentBundle): Promise<AgentConfig> {
  const config = toRunnableConfig(bundle);
  if (!config) throw new Error('实例配置与当前 Schema 不兼容，需升级');

  const sources = await materializeDocuments(
    bundle.agent.id,
    bundle.documents.map((doc) => ({ name: doc.name, content: doc.content })),
  );
  return sources.length > 0
    ? ({ ...config, documents: { ...(config.documents ?? {}), sources } } as AgentConfig)
    : config;
}

/** 运行平台侧实例（含子表折叠与文档物化）。 */
export async function runBundle(
  bundle: AgentBundle,
  input: string,
  sessionId?: string,
): Promise<RunAgentResult> {
  return runAgent(await toRunnable(bundle), input, sessionId);
}

/** 流式运行：把内核事件逐条回调给调用方（用于 NDJSON 响应）。 */
export async function runBundleStream(
  bundle: AgentBundle,
  input: string,
  sessionId: string | undefined,
  onEvent: (event: unknown) => void,
): Promise<RunAgentResult> {
  const config = await toRunnable(bundle);
  const resolved = await resolveAgentConfig(config, {
    pluginFactories: createPresetPluginFactories(config),
    defaultPlugins: defaultCapabilityPlugins(config),
    longTermMemoryFactory: createPresetLongTermMemoryFactory(),
  });

  try {
    const result = await resolved.agent.run(input, { sessionId, onEvent });
    return {
      sessionId: result.sessionId,
      persisted: result.persisted,
      finalText: result.finalMessage.content ?? '',
    };
  } finally {
    await resolved.dispose();
  }
}

/**
 * 运行一个平台侧 agent 实例：把 `AgentConfig` 交给内核装配并跑一轮。
 *
 * 平台不碰内核内部——只负责「取出配置 → 装配 → 运行 → 释放」；
 * 会话历史由内核的 `ConversationStore` 落引擎库，平台侧只拿着 `sessionId` 去读。
 */
export async function runAgent(
  config: AgentConfig,
  input: string,
  sessionId?: string,
): Promise<RunAgentResult> {
  const resolved = await resolveAgentConfig(config, {
    pluginFactories: createPresetPluginFactories(config),
    defaultPlugins: defaultCapabilityPlugins(config),
    longTermMemoryFactory: createPresetLongTermMemoryFactory(),
  });

  try {
    const result = await resolved.agent.run(input, { sessionId });
    return {
      sessionId: result.sessionId,
      persisted: result.persisted,
      finalText: result.finalMessage.content ?? '',
    };
  } finally {
    await resolved.dispose();
  }
}
