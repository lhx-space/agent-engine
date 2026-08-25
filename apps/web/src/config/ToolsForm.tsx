import { Select, Space, Typography } from 'antd';
import type { ToolsConfig } from '@agent-engine/config/schema';

const BUILTIN_TOOL_OPTIONS = [
  { value: 'builtin.todo', label: 'todo（任务规划）' },
  { value: 'builtin.datetime', label: 'datetime（时间）' },
  { value: 'builtin.web_search', label: 'web_search（搜索）' },
  { value: 'builtin.web_fetch', label: 'web_fetch（抓取网页）' },
];

interface ToolsFormProps {
  tools: ToolsConfig;
  onChange: (next: ToolsConfig) => void;
}

export function ToolsForm({ tools, onChange }: ToolsFormProps) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Typography.Text type="secondary">
        默认全部工具可用。选择要禁用的内置工具，或直接输入 plugin / MCP
        工具名禁用（装配末按名移除）。
      </Typography.Text>
      <Select
        mode="tags"
        style={{ width: '100%' }}
        placeholder="选择或输入要禁用的工具名"
        value={tools.disabled}
        options={BUILTIN_TOOL_OPTIONS}
        onChange={(values: string[]) => onChange({ ...tools, disabled: values })}
      />
    </Space>
  );
}
