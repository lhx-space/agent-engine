import { Form, Input, Select } from 'antd';
import type { AgentConfig, Orchestration, OrchestrationMode } from '@agent-engine/config/schema';
import { HooksForm } from '../config/HooksForm';
import { McpForm } from '../config/McpForm';
import { MemoryForm } from '../config/MemoryForm';
import { ModelForm } from '../config/ModelForm';
import { PluginsForm } from '../config/PluginsForm';
import { RulesForm } from '../config/RulesForm';
import { SecurityForm } from '../config/SecurityForm';
import { SkillsForm } from '../config/SkillsForm';
import { ToolsForm } from '../config/ToolsForm';

const ORCHESTRATION_MODES: OrchestrationMode[] = ['single', 'sequential', 'parallel', 'graph'];

/** 构造 agent 配置各轴的 Tabs items（model/rules/.../orchestration）。 */
export function buildConfigTabs(config: AgentConfig, onChange: (next: AgentConfig) => void) {
  const orchestration = config.orchestration ?? { mode: 'single' as const };
  const setOrchestration = (next: Orchestration) => onChange({ ...config, orchestration: next });

  return [
    {
      key: 'model',
      label: 'model',
      children: (
        <ModelForm model={config.model} onChange={(model) => onChange({ ...config, model })} />
      ),
    },
    {
      key: 'rules',
      label: 'rules',
      children: (
        <RulesForm rules={config.rules} onChange={(rules) => onChange({ ...config, rules })} />
      ),
    },
    {
      key: 'tools',
      label: 'tools',
      children: (
        <ToolsForm tools={config.tools} onChange={(tools) => onChange({ ...config, tools })} />
      ),
    },
    {
      key: 'skills',
      label: 'skills',
      children: (
        <SkillsForm skills={config.skills} onChange={(skills) => onChange({ ...config, skills })} />
      ),
    },
    {
      key: 'mcp',
      label: 'mcp',
      children: (
        <McpForm
          servers={config.mcp?.servers ?? []}
          onChange={(servers) => onChange({ ...config, mcp: { ...config.mcp, servers } })}
        />
      ),
    },
    {
      key: 'memory',
      label: 'memory',
      children: (
        <MemoryForm
          memory={config.memory ?? {}}
          onChange={(memory) => onChange({ ...config, memory })}
        />
      ),
    },
    {
      key: 'hooks',
      label: 'hooks',
      children: (
        <HooksForm hooks={config.hooks} onChange={(hooks) => onChange({ ...config, hooks })} />
      ),
    },
    {
      key: 'plugins',
      label: 'plugins',
      children: (
        <PluginsForm
          plugins={config.plugins}
          onChange={(plugins) => onChange({ ...config, plugins })}
        />
      ),
    },
    {
      key: 'security',
      label: 'security',
      children: (
        <SecurityForm
          security={config.security}
          onChange={(security) => onChange({ ...config, security })}
        />
      ),
    },
    {
      key: 'orchestration',
      label: 'orchestration',
      children: (
        <Form layout="vertical" size="small">
          <Form.Item
            label="mode"
            tooltip="single 单 Agent；sequential/parallel/graph 多 Agent 编排（orchestration 包，M3）"
          >
            <Select
              value={orchestration.mode}
              options={ORCHESTRATION_MODES.map((mode) => ({ value: mode, label: mode }))}
              onChange={(mode) => setOrchestration({ ...orchestration, mode })}
            />
          </Form.Item>
          <Form.Item label="name" tooltip="Agent 名称（展示用）" required>
            <Input
              value={config.name}
              onChange={(e) => onChange({ ...config, name: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="description" tooltip="Agent 描述（展示用）">
            <Input
              value={config.description ?? ''}
              onChange={(e) => onChange({ ...config, description: e.target.value || undefined })}
            />
          </Form.Item>
        </Form>
      ),
    },
  ];
}
