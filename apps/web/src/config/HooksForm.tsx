import { Button, Empty, Input, Select, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { HookConfig, HookPoint } from '@agent-engine/config/schema';

const HOOK_POINTS: HookPoint[] = [
  'onInit',
  'onSessionStart',
  'beforeLLM',
  'afterLLM',
  'beforeToolCall',
  'afterToolCall',
  'onStepEnd',
  'onSessionEnd',
  'onError',
];

interface HooksFormProps {
  hooks: HookConfig[];
  onChange: (next: HookConfig[]) => void;
}

export function HooksForm({ hooks, onChange }: HooksFormProps) {
  const set = (index: number, patch: Partial<HookConfig>) =>
    onChange(hooks.map((hook, i) => (i === index ? { ...hook, ...patch } : hook)));
  const remove = (index: number) => onChange(hooks.filter((_, i) => i !== index));
  const add = () => onChange([...hooks, { plugin: '', on: [] }]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {hooks.length === 0 && (
        <Empty
          description="还没有 hook。配置生命周期拦截点（日志/审计/埋点）"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
      {hooks.map((hook, index) => (
        <div key={index} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Input
              placeholder="plugin（如 builtin.logger）"
              value={hook.plugin}
              onChange={(e) => set(index, { plugin: e.target.value })}
            />
            <Select
              mode="multiple"
              value={hook.on}
              options={HOOK_POINTS.map((point) => ({ value: point, label: point }))}
              onChange={(on) => set(index, { on })}
              placeholder="触发时机（可多选）"
              style={{ width: '100%' }}
            />
            <Button
              size="small"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => remove(index)}
            >
              删除 hook
            </Button>
          </Space>
        </div>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={add}>
        添加 hook
      </Button>
    </Space>
  );
}
