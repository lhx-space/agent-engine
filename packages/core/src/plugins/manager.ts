import type { CapabilityBundle } from '../capability/types';
import type { Plugin, PluginContext } from './types';

/** 插件管理器：安装 plugins，把注入的能力收集进 CapabilityBundle。 */
export class PluginManager {
  private readonly assembly: CapabilityBundle = {
    tools: [],
    skills: [],
    hooks: [],
    rules: [],
    promptFragments: [],
    memoryBackends: [],
    cacheBackends: [],
    vectorStores: [],
    embeddingProviders: [],
  };

  /** 安装单个 plugin，能力收集进 assembly。 */
  async install(plugin: Plugin): Promise<void> {
    await plugin.install(this.createContext());
  }

  /** 依次安装多个 plugin。 */
  async installAll(plugins: Plugin[]): Promise<void> {
    for (const plugin of plugins) {
      await this.install(plugin);
    }
  }

  /** 返回收集的能力集合（只读引用，装配层合并用）。 */
  getAssembly(): CapabilityBundle {
    return this.assembly;
  }

  private createContext(): PluginContext {
    return {
      registerTool: (tool) => this.assembly.tools.push(tool),
      registerSkill: (skill) => this.assembly.skills.push(skill),
      registerHook: (hook) => this.assembly.hooks.push(hook),
      registerRule: (rule) => this.assembly.rules.push(rule),
      provideSystemPrompt: (fragment) => this.assembly.promptFragments.push(fragment),
      registerMemoryBackend: (backend) => this.assembly.memoryBackends.push(backend),
      registerCacheBackend: (backend) => this.assembly.cacheBackends.push(backend),
      registerVectorStore: (store) => this.assembly.vectorStores.push(store),
      registerEmbeddingProvider: (provider) => this.assembly.embeddingProviders.push(provider),
    };
  }
}
