import { Button, Form, Input, InputNumber, Modal, Select, Space, Tag, Typography } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { ModelConfig, ModelProvider } from '@agent-engine/config/schema';

const PROVIDERS: ModelProvider[] = ['openai-compatible', 'anthropic', 'custom'];

interface ProviderPreset {
  name: string;
  provider: ModelProvider;
  baseURL?: string;
  model: string;
  description: string;
}

const PRESETS: ProviderPreset[] = [
  {
    name: 'DeepSeek',
    provider: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    description: '默认推荐，OpenAI 兼容协议，官方 API',
  },
  {
    name: 'DeepSeek Reasoner',
    provider: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    description: 'DeepSeek 推理模型',
  },
  {
    name: 'OpenAI',
    provider: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    description: 'OpenAI 官方 API（需 OPENAI_API_KEY）',
  },
  {
    name: 'Ollama（本地）',
    provider: 'openai-compatible',
    baseURL: 'http://localhost:11434/v1',
    model: 'llama3.1:8b',
    description: '本地推理，无需 API Key',
  },
  {
    name: 'Anthropic Claude',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    description: 'Anthropic 官方 SDK（需 ANTHROPIC_API_KEY）',
  },
];

interface ModelFormProps {
  model: ModelConfig;
  onChange: (next: ModelConfig) => void;
}

export function ModelForm({ model, onChange }: ModelFormProps) {
  const [presetOpen, setPresetOpen] = useState(false);

  const applyPreset = (preset: ProviderPreset) => {
    onChange({
      ...model,
      provider: preset.provider,
      baseURL: preset.baseURL,
      model: preset.model,
    });
    setPresetOpen(false);
  };

  return (
    <Form layout="vertical" size="small">
      <Form.Item label="快速选择供应商" tooltip="一键套用常见供应商的 provider / baseURL / model">
        <Button
          block
          icon={<ApiOutlined />}
          onClick={() => setPresetOpen(true)}
          style={{ textAlign: 'left' }}
        >
          选择供应商预设…
        </Button>
      </Form.Item>
      <Form.Item
        label="provider"
        tooltip="模型协议：openai-compatible 默认走 DeepSeek；anthropic 走官方 SDK；custom 按 OpenAI 兼容处理（需显式 baseURL）"
      >
        <Select
          value={model.provider}
          options={PROVIDERS.map((p) => ({ value: p, label: p }))}
          onChange={(provider) => onChange({ ...model, provider })}
        />
      </Form.Item>
      <Form.Item
        label="baseURL"
        tooltip="API 地址。DeepSeek 默认 https://api.deepseek.com"
        extra="留空则使用 DeepSeek 默认地址"
      >
        <Input
          value={model.baseURL ?? ''}
          placeholder="https://api.deepseek.com"
          onChange={(e) => onChange({ ...model, baseURL: e.target.value || undefined })}
        />
      </Form.Item>
      <Form.Item
        label="apiKey"
        tooltip="模型 API Key。留空则回退服务端环境变量 DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY"
        extra="填了就直接用，无需再配环境变量"
      >
        <Input.Password
          value={model.apiKey ?? ''}
          placeholder="sk-..."
          onChange={(e) => onChange({ ...model, apiKey: e.target.value || undefined })}
        />
      </Form.Item>
      <Form.Item label="model" tooltip="模型名，如 deepseek-chat / deepseek-reasoner" required>
        <Input
          value={model.model}
          placeholder="deepseek-chat"
          onChange={(e) => onChange({ ...model, model: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="temperature" tooltip="采样温度，0–2，越高越发散">
        <InputNumber
          min={0}
          max={2}
          step={0.1}
          value={model.temperature}
          onChange={(v) => onChange({ ...model, temperature: v ?? undefined })}
          style={{ width: '100%' }}
        />
      </Form.Item>
      <Form.Item label="maxTokens" tooltip="单次回复最大 token 数">
        <InputNumber
          min={1}
          value={model.maxTokens}
          onChange={(v) => onChange({ ...model, maxTokens: v ?? undefined })}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Modal
        title="选择模型供应商"
        open={presetOpen}
        onCancel={() => setPresetOpen(false)}
        footer={null}
        width={480}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Typography.Text type="secondary">
            选中后自动填充 provider / baseURL / model，apiKey 保持不变。
          </Typography.Text>
          {PRESETS.map((preset) => (
            <div
              key={preset.name}
              role="button"
              tabIndex={0}
              onClick={() => applyPreset(preset)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyPreset(preset);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{preset.name}</div>
                <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                  {preset.description}
                </div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                  {preset.baseURL ? `${preset.baseURL} · ` : ''}
                  {preset.model}
                </div>
              </div>
              <Tag color="blue">{preset.provider}</Tag>
            </div>
          ))}
        </Space>
      </Modal>
    </Form>
  );
}
