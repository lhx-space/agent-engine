import { useState } from 'react';
import { Card, ConfigProvider, Layout, Typography } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AgentConfigSchema, type AgentConfig } from '@agent-engine/config/schema';
import { ChatPanel } from './panels/ChatPanel';
import { ConfigPanel } from './panels/ConfigPanel';
import { SystemPromptPanel } from './panels/SystemPromptPanel';

const { Header, Content } = Layout;

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
});

export function App() {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);

  return (
    <ConfigProvider locale={zhCN}>
      <Layout className="editor">
        <Header className="editor__header">
          <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
            Agent Engine — 配置即 Agent
          </Typography.Title>
          <Typography.Text type="secondary" style={{ color: 'rgba(255,255,255,0.65)' }}>
            plugins · mcp · skills · tools · system-prompt · memory · rules · hooks 全部可配置
          </Typography.Text>
        </Header>
        <Content className="editor__content">
          <Card className="editor__col editor__col--chat" title="对话" size="small">
            <ChatPanel config={config} />
          </Card>
          <Card className="editor__col" title="agent 配置（八大可配置项）" size="small">
            <ConfigPanel config={config} onChange={setConfig} />
          </Card>
          <Card className="editor__col" title="system-prompt（人设与约束）" size="small">
            <SystemPromptPanel
              systemPrompt={config.systemPrompt}
              onChange={(systemPrompt) => setConfig({ ...config, systemPrompt })}
            />
          </Card>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
