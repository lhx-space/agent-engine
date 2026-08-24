import { Button, Input, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

export interface KVEntry {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  entries: KVEntry[];
  onChange: (next: KVEntry[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}

/** 通用 key/value 列表编辑器（复用：system-prompt variables、mcp server env 等）。 */
export function KeyValueEditor({
  entries,
  onChange,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
  addLabel = '添加',
}: KeyValueEditorProps) {
  const set = (index: number, patch: Partial<KVEntry>) =>
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const remove = (index: number) => onChange(entries.filter((_, i) => i !== index));
  const add = () => onChange([...entries, { key: '', value: '' }]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      {entries.map((entry, index) => (
        <Space.Compact key={index} style={{ width: '100%' }}>
          <Input
            value={entry.key}
            placeholder={keyPlaceholder}
            onChange={(e) => set(index, { key: e.target.value })}
          />
          <Input
            value={entry.value}
            placeholder={valuePlaceholder}
            onChange={(e) => set(index, { value: e.target.value })}
          />
          <Button icon={<MinusCircleOutlined />} onClick={() => remove(index)} aria-label="删除" />
        </Space.Compact>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={add}>
        {addLabel}
      </Button>
    </Space>
  );
}
