import { create } from 'zustand';
import { AgentConfigSchema, type AgentConfig } from '@agent-engine/config/schema';

const defaultConfig: AgentConfig = AgentConfigSchema.parse({
  name: 'demo-agent',
  description: '演示 Agent',
  version: '1.0.0',
  model: { provider: 'openai-compatible', model: 'deepseek-chat', temperature: 0.7 },
  systemPrompt: {
    template:
      '你是 DevOps 运维专家，专注于云原生与 CI/CD。\n\n回答要求：\n- 先给结论，再给依据；\n- 涉及危险命令前先说明影响范围。',
  },
  rules: [
    {
      id: 'no-destructive-command',
      kind: 'always',
      description: '禁止执行破坏性命令',
      content: '禁止执行 rm -rf、DROP TABLE 等破坏性命令；执行前须说明影响范围并征得确认。',
      tags: ['安全', '运维'],
    },
  ],
  security: {
    files: { roots: ['./'] },
  },
});

interface ConfigState {
  config: AgentConfig;
  setConfig: (config: AgentConfig) => void;
  patch: (patch: Partial<AgentConfig>) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: defaultConfig,
  setConfig: (config) => set({ config }),
  patch: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
}));
