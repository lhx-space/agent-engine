import { Button, Empty, Input, Select, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { Rule, RuleKind } from '@lhx-agent-engine/config/schema';

const KINDS: RuleKind[] = ['always', 'on-demand'];

interface RulesFormProps {
  rules: Rule[];
  onChange: (next: Rule[]) => void;
}

export function RulesForm({ rules, onChange }: RulesFormProps) {
  const set = (index: number, patch: Partial<Rule>) =>
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  const remove = (index: number) => onChange(rules.filter((_, i) => i !== index));
  const add = () =>
    onChange([...rules, { id: '', kind: 'on-demand', description: '', content: '', tags: [] }]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {rules.length === 0 && (
        <Empty
          description="还没有规则，点击下方「添加规则」"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
      {rules.map((rule, index) => (
        <div key={index} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="id（唯一标识）"
                value={rule.id}
                onChange={(e) => set(index, { id: e.target.value })}
              />
              <Select
                value={rule.kind}
                options={KINDS.map((kind) => ({ value: kind, label: kind }))}
                onChange={(kind) => set(index, { kind })}
                style={{ width: 130 }}
              />
            </Space.Compact>
            <Input
              placeholder="description（匹配面，用于检索）"
              value={rule.description}
              onChange={(e) => set(index, { description: e.target.value })}
            />
            <Input.TextArea
              placeholder="content（规则正文，markdown）"
              rows={3}
              value={rule.content}
              onChange={(e) => set(index, { content: e.target.value })}
            />
            <Select
              mode="tags"
              value={rule.tags}
              onChange={(tags) => set(index, { tags })}
              placeholder="tags（同义词，回车添加）"
              open={false}
              suffixIcon={null}
              style={{ width: '100%' }}
            />
            <Button
              size="small"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => remove(index)}
            >
              删除规则
            </Button>
          </Space>
        </div>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={add}>
        添加规则
      </Button>
    </Space>
  );
}
