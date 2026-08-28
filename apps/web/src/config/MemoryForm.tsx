import { Form, InputNumber, Select } from 'antd';
import type { MemoryConfig } from '@lhx-agent-engine/config/schema';

const LONG_TERM_BACKENDS = ['in-memory', 'pgvector', 'chroma', 'lanceDB', 'meilisearch'];

interface MemoryFormProps {
  memory: MemoryConfig;
  onChange: (next: MemoryConfig) => void;
}

export function MemoryForm({ memory, onChange }: MemoryFormProps) {
  const session = memory.session ?? { summary: false };
  const longTerm = memory.longTerm ?? { backend: 'in-memory' };

  return (
    <Form layout="vertical" size="small">
      <Form.Item
        label="session.maxMessages"
        tooltip="会话上下文窗口保留的最大消息条数（多轮对话记忆，超限按条数裁剪）"
      >
        <InputNumber
          min={1}
          value={session.maxMessages}
          onChange={(v) =>
            onChange({ ...memory, session: { ...session, maxMessages: v ?? undefined } })
          }
          style={{ width: '100%' }}
          placeholder="50"
        />
      </Form.Item>
      <Form.Item
        label="longTerm.backend"
        tooltip="长期记忆后端（跨会话持久化 + 向量检索；开发默认 in-memory，生产 pgvector）"
      >
        <Select
          value={longTerm.backend}
          options={LONG_TERM_BACKENDS.map((backend) => ({ value: backend, label: backend }))}
          onChange={(backend) => onChange({ ...memory, longTerm: { ...longTerm, backend } })}
        />
      </Form.Item>
    </Form>
  );
}
