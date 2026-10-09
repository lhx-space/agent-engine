'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Empty, List, Space, Tag, Typography, message } from 'antd';

interface Item {
  id: string;
  type: string;
  slug: string;
  name: string;
  summary?: string | null;
  status: string;
  latestVersionId?: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  sourceItemId?: string | null;
}

export default function MarketPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [itemRes, agentRes] = await Promise.all([
      fetch('/api/marketplace/items'),
      fetch('/api/agents'),
    ]);
    const itemData = (await itemRes.json()) as { items: Item[] };
    const agentData = (await agentRes.json()) as { agents: AgentRow[] };
    setItems(itemData.items);
    setAgents(agentData.agents);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function install(itemId: string) {
    setInstalling(itemId);
    try {
      const response = await fetch(`/api/marketplace/items/${itemId}/install`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ configOverrides: {} }),
      });
      const data = (await response.json()) as { agentId?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      message.success('安装成功');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setInstalling(null);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="我的 agent">
        {agents.length === 0 ? (
          <Empty description="还没有安装任何 agent" />
        ) : (
          <List
            dataSource={agents}
            renderItem={(agent) => (
              <List.Item
                actions={[
                  <Link key="open" href={`/agents/${agent.id}`}>
                    <Button type="link">打开</Button>
                  </Link>,
                ]}
              >
                <List.Item.Meta
                  title={agent.name}
                  description={
                    <Space size={4}>
                      <Tag>{agent.slug}</Tag>
                      {agent.sourceItemId ? <Tag color="blue">来自市场</Tag> : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title="市场">
        {items.length === 0 ? (
          <Empty description="市场暂无商品" />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="install"
                    type="primary"
                    loading={installing === item.id}
                    onClick={() => void install(item.id)}
                  >
                    安装
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong>{item.name}</Typography.Text>
                      <Tag color={item.type === 'agent' ? 'geekblue' : 'green'}>{item.type}</Tag>
                    </Space>
                  }
                  description={item.summary ?? item.slug}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}
