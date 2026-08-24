import { Button, Empty, Input, Select, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { SkillRef, SkillSource } from '@agent-engine/config/schema';

const SOURCES: SkillSource[] = ['path', 'npm', 'git'];

interface SkillsFormProps {
  skills: SkillRef[];
  onChange: (next: SkillRef[]) => void;
}

export function SkillsForm({ skills, onChange }: SkillsFormProps) {
  const set = (index: number, patch: Partial<SkillRef>) =>
    onChange(
      skills.map((skill, i) => (i === index ? ({ ...skill, ...patch } as SkillRef) : skill)),
    );
  const setSource = (index: number, source: SkillSource) =>
    onChange(
      skills.map((skill, i) => {
        if (i !== index) return skill;
        switch (source) {
          case 'path':
            return { source, path: '' };
          case 'npm':
            return { source, package: '', version: undefined };
          case 'git':
            return { source, url: '', ref: undefined };
        }
      }),
    );
  const remove = (index: number) => onChange(skills.filter((_, i) => i !== index));
  const add = () => onChange([...skills, { source: 'path', path: './skills/example-skill' }]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {skills.length === 0 && (
        <Empty
          description="还没有 skill。可从本地目录 / npm 包 / git 仓库加载（含 SKILL.md）"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
      {skills.map((skill, index) => (
        <div key={index} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Space.Compact style={{ width: '100%' }}>
              <Select
                value={skill.source}
                options={SOURCES.map((source) => ({ value: source, label: source }))}
                onChange={(source) => setSource(index, source)}
                style={{ width: 110 }}
              />
              {skill.source === 'path' && (
                <Input
                  value={skill.path}
                  placeholder="./skills/incident-response"
                  onChange={(e) => set(index, { path: e.target.value } as Partial<SkillRef>)}
                />
              )}
              {skill.source === 'npm' && (
                <Input
                  value={skill.package}
                  placeholder="@agent-engine/skill-k8s"
                  onChange={(e) => set(index, { package: e.target.value } as Partial<SkillRef>)}
                />
              )}
              {skill.source === 'git' && (
                <Input
                  value={skill.url}
                  placeholder="https://github.com/org/skill.git"
                  onChange={(e) => set(index, { url: e.target.value } as Partial<SkillRef>)}
                />
              )}
            </Space.Compact>
            {skill.source === 'npm' && (
              <Input
                value={skill.version ?? ''}
                placeholder="version（可选，如 1.0.0）"
                onChange={(e) =>
                  set(index, { version: e.target.value || undefined } as Partial<SkillRef>)
                }
              />
            )}
            {skill.source === 'git' && (
              <Input
                value={skill.ref ?? ''}
                placeholder="ref（可选，如 main）"
                onChange={(e) =>
                  set(index, { ref: e.target.value || undefined } as Partial<SkillRef>)
                }
              />
            )}
            <Button
              size="small"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => remove(index)}
            >
              删除 skill
            </Button>
          </Space>
        </div>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={add}>
        添加 skill
      </Button>
    </Space>
  );
}
