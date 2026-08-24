import { useState } from 'react';
import { Alert, Button, Input, Space, Tag } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { AgentConfig } from '@agent-engine/config/schema';
import { requiredEnv } from '../lib/env-hints';
import { runAgent } from '../lib/run-agent';

interface RunPanelProps {
  config: AgentConfig;
}

export function RunPanel({ config }: RunPanelProps) {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const envs = requiredEnv(config);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await runAgent(config, input);
      setResult(res.finalMessage.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <div>
        <div style={{ marginBottom: 4, color: '#666', fontSize: 12 }}>密钥来源</div>
        {config.model.apiKey ? (
          <Tag color="green">已填 API Key（配置内）</Tag>
        ) : envs.length === 0 ? (
          <Tag color="green">无需密钥（如本地 ollama）</Tag>
        ) : (
          <Space size={[4, 4]} wrap>
            {envs.map((env) => (
              <Tag key={env.name} color="blue" title={env.reason}>
                {env.name}
              </Tag>
            ))}
          </Space>
        )}
      </div>
      <Input.TextArea
        value={input}
        rows={4}
        placeholder="输入消息，测试你的 Agent…"
        onChange={(e) => setInput(e.target.value)}
      />
      <Button
        type="primary"
        block
        icon={<PlayCircleOutlined />}
        loading={running}
        disabled={running || input.trim() === ''}
        onClick={run}
      >
        {running ? '运行中…' : '运行'}
      </Button>
      {error !== null && <Alert type="error" showIcon message="运行失败" description={error} />}
      {result !== null && <pre className="run-result">{result}</pre>}
    </Space>
  );
}
