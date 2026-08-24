import { Bubble } from '@ant-design/x';
import { Button, Collapse, Input, Space, Tag } from 'antd';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentConfig } from '@agent-engine/config/schema';
import { useStreamChat, type ChatMessage, type ChatStep } from '../hooks/use-stream-chat';

interface ChatPanelProps {
  config: AgentConfig;
}

/** assistant 消息内容：markdown 渲染。 */
function AssistantContent({ message }: { message: ChatMessage }) {
  return (
    <div className="chat-markdown">
      <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
      {message.status === 'streaming' && <span className="chat-cursor">▍</span>}
    </div>
  );
}

/** 模型思考过程（灰显、默认折叠，与回复正文分开）。 */
function ReasoningBlock({ reasoning }: { reasoning?: string }) {
  if (!reasoning) return null;
  return (
    <Collapse
      size="small"
      ghost
      items={[
        {
          key: 'reasoning',
          label: <span className="chat-reasoning-label">思考过程</span>,
          children: (
            <div className="chat-reasoning">
              <Markdown remarkPlugins={[remarkGfm]}>{reasoning}</Markdown>
            </div>
          ),
        },
      ]}
    />
  );
}

/** 步骤时间线（折叠展示 tool/hook 每一步）。 */
function StepsTimeline({ steps }: { steps: ChatStep[] }) {
  if (steps.length === 0) return null;
  const items = steps.map((step) => ({
    key: step.key,
    label: (
      <span>
        {step.kind === 'tool' && (
          <Tag color="blue" style={{ marginRight: 6 }}>
            tool
          </Tag>
        )}
        {step.kind === 'hook' && (
          <Tag color="purple" style={{ marginRight: 6 }}>
            hook
          </Tag>
        )}
        {step.title}
      </span>
    ),
    children: step.detail ? <pre className="chat-step-detail">{step.detail}</pre> : null,
  }));
  return (
    <Collapse
      size="small"
      ghost
      items={[
        {
          key: 'steps',
          label: `步骤（${steps.length}）`,
          children: <Collapse size="small" items={items} />,
        },
      ]}
    />
  );
}

export function ChatPanel({ config }: ChatPanelProps) {
  const { messages, running, send, stop } = useStreamChat(config);
  const [input, setInput] = useState('');

  const bubbleItems = useMemo(
    () =>
      messages.map((message) => ({
        key: message.id,
        role: message.role === 'user' ? 'user' : 'ai',
        content: message.content,
        placement: message.role === 'user' ? ('end' as const) : ('start' as const),
        contentRender:
          message.role === 'assistant'
            ? () => (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <ReasoningBlock reasoning={message.reasoning} />
                  <AssistantContent message={message} />
                  {message.error && <Tag color="red">错误：{message.error}</Tag>}
                  <StepsTimeline steps={message.steps} />
                </Space>
              )
            : undefined,
      })),
    [messages],
  );

  const submit = () => {
    const text = input.trim();
    if (!text || running) return;
    setInput('');
    send(text);
  };

  return (
    <div className="chat-panel">
      <div className="chat-list">
        <Bubble.List
          items={bubbleItems}
          autoScroll
          role={{
            user: { variant: 'filled' },
            ai: { variant: 'outlined' },
          }}
        />
      </div>
      <div className="chat-input">
        <Input.TextArea
          value={input}
          rows={3}
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder="输入消息，测试你的 Agent…（Enter 发送，Shift+Enter 换行）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {running ? (
          <Button danger icon={<StopOutlined />} onClick={stop}>
            停止
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={input.trim() === ''}
            onClick={submit}
          >
            发送
          </Button>
        )}
      </div>
    </div>
  );
}
