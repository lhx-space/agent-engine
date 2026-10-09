'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { DownloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Spin, Tabs, Typography, message } from 'antd';
import type { AgentConfig } from '@lhx-agent-engine/config';
import { buildConfigTabs } from '@/components/config/ConfigPanel';
import { SystemPromptPanel } from '@/components/config/SystemPromptPanel';
import { exportConfig } from '@/lib/export-config';

/** 实例配置编辑页：system-prompt + 各配置轴（复用自 apps/web 的表单组件）。 */
export default function AgentConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/agents/${id}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { agent: { config: AgentConfig } };
        setConfig(data.agent.config);
      } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
      }
    })();
  }, [id]);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      message.success('配置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return <Spin />;
  }

  const items = [
    {
      key: 'system-prompt',
      label: 'system-prompt',
      children: (
        <SystemPromptPanel
          systemPrompt={config.systemPrompt}
          onChange={(systemPrompt) => setConfig({ ...config, systemPrompt })}
        />
      ),
    },
    ...buildConfigTabs(config, (next) => setConfig(next)),
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
        <Link href={`/agents/${id}`}>
          <Button size="small">返回对话</Button>
        </Link>
        <Typography.Title level={5} style={{ margin: 0 }}>
          配置
        </Typography.Title>
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => void save()}
        >
          保存
        </Button>
        <Dropdown
          menu={{
            items: [
              { key: 'yaml', label: '导出 YAML' },
              { key: 'json', label: '导出 JSON' },
            ],
            onClick: ({ key }) => exportConfig(config, key as 'yaml' | 'json'),
          }}
        >
          <Button size="small" icon={<DownloadOutlined />}>
            导出
          </Button>
        </Dropdown>
      </Space>
      <Tabs size="small" tabPosition="left" items={items} />
    </Space>
  );
}
