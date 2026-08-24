import { AutoComplete, Button, Empty, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { ToolRef } from '@agent-engine/config/schema';

const BUILTIN_TOOLS = [
  'builtin.todo',
  'builtin.read_file',
  'builtin.write_file',
  'builtin.bash',
  'builtin.web_search',
  'builtin.web_fetch',
  'builtin.sitesearch',
  'builtin.calculator',
  'builtin.datetime',
  'builtin.json',
  'builtin.base64',
];

interface ToolsFormProps {
  tools: ToolRef[];
  onChange: (next: ToolRef[]) => void;
}

export function ToolsForm({ tools, onChange }: ToolsFormProps) {
  const set = (index: number, use: string) =>
    onChange(tools.map((tool, i) => (i === index ? { use } : tool)));
  const remove = (index: number) => onChange(tools.filter((_, i) => i !== index));
  const add = () => onChange([...tools, { use: 'builtin.read_file' }]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {tools.length === 0 && (
        <Empty
          description="还没有工具。可从内置工具选择，或填写插件/MCP 提供的工具名"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
      {tools.map((tool, index) => (
        <Space.Compact key={index} style={{ width: '100%' }}>
          <AutoComplete
            style={{ width: '100%' }}
            value={tool.use}
            options={BUILTIN_TOOLS.map((use) => ({ value: use }))}
            onChange={(use) => set(index, use)}
            placeholder="builtin.read_file 或自定义工具名"
            filterOption={(input, option) =>
              (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Button icon={<MinusCircleOutlined />} onClick={() => remove(index)} aria-label="删除" />
        </Space.Compact>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={add}>
        添加工具
      </Button>
    </Space>
  );
}
