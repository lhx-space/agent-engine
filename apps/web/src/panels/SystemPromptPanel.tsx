import { Alert, Form, Input } from 'antd';
import type { SystemPrompt } from '@lhx-agent-engine/config/schema';

interface SystemPromptPanelProps {
  systemPrompt: SystemPrompt;
  onChange: (next: SystemPrompt) => void;
}

export function SystemPromptPanel({ systemPrompt, onChange }: SystemPromptPanelProps) {
  return (
    <Form layout="vertical" size="small">
      <Form.Item
        label="系统提示词"
        tooltip="直接写 markdown 文本，定义 Agent 的人设与行为约束"
        required
      >
        <Input.TextArea
          value={systemPrompt.template}
          rows={18}
          placeholder={
            '你是 DevOps 运维专家，专注于云原生与 CI/CD。\n\n回答要求：\n- 先给结论，再给依据；\n- 涉及危险命令前先说明影响范围。'
          }
          onChange={(e) => onChange({ ...systemPrompt, template: e.target.value })}
        />
      </Form.Item>
      <Alert
        type="info"
        showIcon
        message="rules / skills 无需在这里写"
        description="它们是在「agent 配置」的 rules / skills 里单独配置的，运行时由内核按需检索并自动注入到系统提示词末尾，不用手写任何占位符。"
      />
    </Form>
  );
}
