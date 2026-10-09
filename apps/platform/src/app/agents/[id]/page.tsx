'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Space, Spin, Typography, message } from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
}

export default function AgentChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // 挂载时拉最近一次会话的历史（后端为 in-memory 时为空，属预期）。
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/agents/${id}/sessions?limit=1`);
        if (!res.ok) return;
        const data = (await res.json()) as { sessions: { id: string }[] };
        const latest = data.sessions[0];
        if (!latest) return;
        setSessionId(latest.id);
        const msgRes = await fetch(`/api/agents/${id}/sessions/${latest.id}/messages?limit=50`);
        if (!msgRes.ok) return;
        const msgData = (await msgRes.json()) as { messages: Message[] };
        setMessages(msgData.messages.filter((m) => m.role !== 'system' && m.content));
      } catch {
        // 拉历史失败不阻断聊天
      }
    })();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || running) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setRunning(true);
    try {
      const response = await fetch(`/api/agents/${id}/run`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(sessionId ? { 'x-session-id': sessionId } : {}),
        },
        body: JSON.stringify({ input: question }),
      });
      const data = (await response.json()) as {
        finalText?: string;
        sessionId?: string;
        persisted?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.persisted === false) message.warning('本次对话未能持久化到存储后端');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.finalText ?? '' }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <Space style={{ marginBottom: 16 }}>
        <Link href="/">
          <Button icon={<ArrowLeftOutlined />} />
        </Link>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {id}
        </Typography.Title>
        <Button
          size="small"
          onClick={() => {
            setSessionId('');
            setMessages([]);
          }}
        >
          新会话
        </Button>
      </Space>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 320, marginBottom: 12 }}>
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 12,
                whiteSpace: 'pre-wrap',
                background: message.role === 'user' ? '#1677ff' : '#f5f5f5',
                color: message.role === 'user' ? '#fff' : '#333',
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        {running && <Spin size="small" />}
        <div ref={bottomRef} />
      </div>

      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="输入问题，回车发送"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={running}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => void send()}
          disabled={running || !input.trim()}
        >
          发送
        </Button>
      </Space.Compact>
    </div>
  );
}
