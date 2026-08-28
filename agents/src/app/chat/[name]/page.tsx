'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { Button, Input, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import { getApiKey } from '@/lib/api-key';
import { Markdown } from '@/components/markdown';

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export default function ChatPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [assistantText, setAssistantText] = useState('');
  const [thinking, setThinking] = useState('');
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, assistantText, thinking]);

  async function send() {
    const question = input.trim();
    if (!question || running) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setAssistantText('');
    setThinking('');
    setRunning(true);

    try {
      const response = await fetch(`/api/agent/${name}/run/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: question, apiKey: getApiKey() }),
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalText = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            delta?: string;
            kind?: string;
            name?: string;
            args?: string;
            error?: string;
          };
          if (event.type === 'llm_delta') {
            if (event.kind === 'reasoning') {
              setThinking((prev) => prev + (event.delta ?? ''));
            } else {
              finalText += event.delta ?? '';
              setAssistantText(finalText);
            }
          } else if (event.type === 'tool_call') {
            setMessages((prev) => [
              ...prev,
              { role: 'tool', content: `🔧 ${event.name}(${event.args ?? ''})` },
            ]);
          } else if (event.type === 'error') {
            setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${event.error}` }]);
          }
        }
      }

      if (finalText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: finalText }]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setAssistantText('');
      setThinking('');
      setRunning(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      <Space style={{ marginBottom: 16 }}>
        <Link href="/">
          <Button icon={<ArrowLeftOutlined />} />
        </Link>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {name}
        </Typography.Title>
      </Space>

      <div style={{ flex: 1, overflow: 'auto', paddingRight: 8, marginBottom: 12 }}>
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{ maxWidth: '80%' }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#999',
                  marginBottom: 4,
                  textAlign: message.role === 'user' ? 'right' : 'left',
                }}
              >
                {message.role === 'user' ? '你' : message.role === 'tool' ? '工具' : name}
              </div>
              {message.role === 'assistant' ? (
                <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 12 }}>
                  <Markdown>{message.content}</Markdown>
                </div>
              ) : (
                <div
                  style={{
                    background: message.role === 'user' ? '#1677ff' : '#f6ffed',
                    color: message.role === 'user' ? '#fff' : '#333',
                    padding: '8px 12px',
                    borderRadius: 12,
                    whiteSpace: 'pre-wrap',
                    border: message.role === 'tool' ? '1px solid #b7eb8f' : 'none',
                  }}
                >
                  {message.content}
                </div>
              )}
            </div>
          </div>
        ))}
        {assistantText && (
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ maxWidth: '80%' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{name}</div>
              <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 12 }}>
                <Markdown>{assistantText}</Markdown>
              </div>
            </div>
          </div>
        )}
        {thinking && (
          <div style={{ color: '#999', fontSize: 13, fontStyle: 'italic', marginBottom: 8 }}>
            💭 {thinking}
          </div>
        )}
        {running && !assistantText && !thinking && <Spin size="small" />}
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
          placeholder="输入问题，回车发送，Shift+回车换行"
          autoSize={{ minRows: 1, maxRows: 6 }}
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
