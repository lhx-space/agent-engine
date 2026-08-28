'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Input, List, Modal, Space, Typography } from 'antd';
import { MessageOutlined, SettingOutlined } from '@ant-design/icons';
import { getApiKey, setApiKey } from '@/lib/api-key';

interface Agent {
  name: string;
  description?: string;
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    fetch('/api/agents')
      .then((response) => response.json())
      .then((data: { agents?: Agent[] }) => setAgents(data.agents ?? []))
      .finally(() => setLoading(false));
    setApiKeyInput(getApiKey());
  }, []);

  const saveSettings = () => {
    setApiKey(apiKeyInput.trim());
    setSettingsOpen(false);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Agent Engine
          </Typography.Title>
          <Typography.Text type="secondary">
            一个 agent = .lhx-agent/&lt;name&gt;/ 目录（文件形式）
          </Typography.Text>
        </div>
        <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
          设置
        </Button>
      </Space>

      <List
        loading={loading}
        dataSource={agents}
        locale={{ emptyText: '暂无 agent —— 请在 .lhx-agent/ 下创建目录' }}
        renderItem={(agent) => (
          <List.Item
            actions={[
              <Link key="chat" href={`/chat/${agent.name}`}>
                <Button type="primary" icon={<MessageOutlined />}>
                  对话
                </Button>
              </Link>,
            ]}
          >
            <List.Item.Meta
              title={<Link href={`/chat/${agent.name}`}>{agent.name}</Link>}
              description={agent.description}
            />
          </List.Item>
        )}
      />

      <Modal
        title="设置"
        open={settingsOpen}
        onOk={saveSettings}
        onCancel={() => setSettingsOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          配置默认 API Key（如 DeepSeek）。请求时优先用此 key，未配置则回退到环境变量。
        </Typography.Paragraph>
        <Input.Password
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder="sk-..."
        />
      </Modal>
    </div>
  );
}
