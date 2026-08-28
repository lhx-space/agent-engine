import { Select } from 'antd';

const KNOWN_PLUGINS = [
  '@lhx-agent-engine/plugin-files',
  '@lhx-agent-engine/plugin-bash',
  '@lhx-agent-engine/plugin-git',
  '@lhx-agent-engine/plugin-otel',
];

interface PluginsFormProps {
  plugins: string[];
  onChange: (next: string[]) => void;
}

export function PluginsForm({ plugins, onChange }: PluginsFormProps) {
  return (
    <Select
      mode="tags"
      value={plugins}
      onChange={onChange}
      options={KNOWN_PLUGINS.map((name) => ({ value: name, label: name }))}
      placeholder="输入插件名后回车（如 @lhx-agent-engine/plugin-git）"
      style={{ width: '100%' }}
    />
  );
}
