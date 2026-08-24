import { Collapse, Form, Input, InputNumber, Select, Switch } from 'antd';
import {
  defaultSecurityConfig,
  type SecurityConfig,
  type SandboxBackendKind,
} from '@agent-engine/config/schema';

const SANDBOX_BACKENDS: SandboxBackendKind[] = ['docker', 'nsjail', 'auto'];
const SEARCH_PROVIDERS = ['duckduckgo', 'tavily', 'serpapi', 'searxng'];

/** 深比较（纯数据对象）。 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface SecurityPreset {
  key: string;
  label: string;
  description: string;
  value: SecurityConfig;
}

const SECURITY_PRESETS: SecurityPreset[] = [
  {
    key: 'strict',
    label: 'strict',
    description: '默认安全：bash 关闭、无网络、文件只读',
    value: defaultSecurityConfig,
  },
  {
    key: 'balanced',
    label: 'balanced',
    description: 'bash 只读命令白名单 + 文件读写当前目录',
    value: {
      ...defaultSecurityConfig,
      bash: {
        ...defaultSecurityConfig.bash,
        enabled: true,
        allowCommands: ['ls', 'cat', 'pwd', 'git'],
      },
      files: { ...defaultSecurityConfig.files, roots: ['./'] },
    },
  },
  {
    key: 'permissive',
    label: 'permissive',
    description: 'bash 开启 + 允许网络 + 破坏性命令黑名单',
    value: {
      ...defaultSecurityConfig,
      bash: {
        ...defaultSecurityConfig.bash,
        enabled: true,
        allowNetwork: true,
        denyPatterns: ['rm -rf', 'DROP TABLE', 'DROP DATABASE'],
      },
      files: { ...defaultSecurityConfig.files, roots: ['./'] },
    },
  },
];

interface SecurityFormProps {
  security: SecurityConfig;
  onChange: (next: SecurityConfig) => void;
}

function StringListField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <Form.Item label={label}>
      <Select
        mode="tags"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        open={false}
        suffixIcon={null}
        style={{ width: '100%' }}
      />
    </Form.Item>
  );
}

export function SecurityForm({ security, onChange }: SecurityFormProps) {
  const sandbox = security.sandbox;
  const bash = security.bash;
  const files = security.files;
  const webSearch = security.webSearch;
  const webFetch = security.webFetch;

  const items = [
    {
      key: 'sandbox',
      label: 'sandbox（执行沙箱）',
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label="backend" tooltip="auto 自动探测 docker/nsjail；不可用则 bash 禁用">
            <Select
              value={sandbox.backend}
              options={SANDBOX_BACKENDS.map((backend) => ({ value: backend, label: backend }))}
              onChange={(backend) => onChange({ ...security, sandbox: { ...sandbox, backend } })}
            />
          </Form.Item>
          <Form.Item label="image" tooltip="docker 沙箱镜像名">
            <Input
              value={sandbox.image}
              onChange={(e) =>
                onChange({ ...security, sandbox: { ...sandbox, image: e.target.value } })
              }
            />
          </Form.Item>
          <Form.Item label="workspaceRoot" tooltip="沙箱内工作目录（可选）">
            <Input
              value={sandbox.workspaceRoot ?? ''}
              placeholder="/workspace"
              onChange={(e) =>
                onChange({
                  ...security,
                  sandbox: { ...sandbox, workspaceRoot: e.target.value || undefined },
                })
              }
            />
          </Form.Item>
          <Form.Item
            label="compact"
            tooltip="开启后经 rtk 压缩命令输出省 token"
            valuePropName="checked"
          >
            <Switch
              checked={sandbox.compact}
              onChange={(compact) => onChange({ ...security, sandbox: { ...sandbox, compact } })}
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'bash',
      label: 'bash（命令执行）',
      children: (
        <Form layout="vertical" size="small">
          <Form.Item
            label="enabled"
            tooltip="默认 false；开启后命令经沙箱执行（绝不裸奔）"
            valuePropName="checked"
          >
            <Switch
              checked={bash.enabled}
              onChange={(enabled) => onChange({ ...security, bash: { ...bash, enabled } })}
            />
          </Form.Item>
          <StringListField
            label="allowCommands"
            value={bash.allowCommands}
            placeholder="kubectl / git / ls"
            onChange={(allowCommands) =>
              onChange({ ...security, bash: { ...bash, allowCommands } })
            }
          />
          <StringListField
            label="denyPatterns"
            value={bash.denyPatterns}
            placeholder="rm -rf"
            onChange={(denyPatterns) => onChange({ ...security, bash: { ...bash, denyPatterns } })}
          />
          <Form.Item label="allowNetwork" tooltip="kubectl 连集群需开启" valuePropName="checked">
            <Switch
              checked={bash.allowNetwork}
              onChange={(allowNetwork) =>
                onChange({ ...security, bash: { ...bash, allowNetwork } })
              }
            />
          </Form.Item>
          <Form.Item label="timeoutMs">
            <InputNumber
              min={1}
              value={bash.timeoutMs}
              onChange={(v) => onChange({ ...security, bash: { ...bash, timeoutMs: v ?? 30000 } })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="maxOutputBytes">
            <InputNumber
              min={1}
              value={bash.maxOutputBytes}
              onChange={(v) =>
                onChange({ ...security, bash: { ...bash, maxOutputBytes: v ?? 65536 } })
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'files',
      label: 'files（文件读写）',
      children: (
        <Form layout="vertical" size="small">
          <StringListField
            label="roots"
            value={files.roots}
            placeholder="/workspace"
            onChange={(roots) => onChange({ ...security, files: { ...files, roots } })}
          />
          <Form.Item label="maxFileBytes">
            <InputNumber
              min={1}
              value={files.maxFileBytes}
              onChange={(v) =>
                onChange({ ...security, files: { ...files, maxFileBytes: v ?? 1048576 } })
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'webSearch',
      label: 'webSearch（搜索）',
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label="provider" tooltip="搜索后端（可插拔）">
            <Select
              value={webSearch.provider}
              options={SEARCH_PROVIDERS.map((provider) => ({ value: provider, label: provider }))}
              onChange={(provider) =>
                onChange({ ...security, webSearch: { ...webSearch, provider } })
              }
            />
          </Form.Item>
          <Form.Item label="maxResults">
            <InputNumber
              min={1}
              value={webSearch.maxResults}
              onChange={(v) =>
                onChange({ ...security, webSearch: { ...webSearch, maxResults: v ?? 8 } })
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="timeoutMs">
            <InputNumber
              min={1}
              value={webSearch.timeoutMs}
              onChange={(v) =>
                onChange({ ...security, webSearch: { ...webSearch, timeoutMs: v ?? 10000 } })
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'webFetch',
      label: 'webFetch（网页抓取）',
      children: (
        <Form layout="vertical" size="small">
          <StringListField
            label="allowDomains"
            value={webFetch.allowDomains}
            placeholder="example.com"
            onChange={(allowDomains) =>
              onChange({ ...security, webFetch: { ...webFetch, allowDomains } })
            }
          />
          <StringListField
            label="denyDomains"
            value={webFetch.denyDomains}
            placeholder="internal.local"
            onChange={(denyDomains) =>
              onChange({ ...security, webFetch: { ...webFetch, denyDomains } })
            }
          />
          <Form.Item label="timeoutMs">
            <InputNumber
              min={1}
              value={webFetch.timeoutMs}
              onChange={(v) =>
                onChange({ ...security, webFetch: { ...webFetch, timeoutMs: v ?? 15000 } })
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="maxOutputBytes">
            <InputNumber
              min={1}
              value={webFetch.maxOutputBytes}
              onChange={(v) =>
                onChange({ ...security, webFetch: { ...webFetch, maxOutputBytes: v ?? 32768 } })
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      ),
    },
  ];

  const currentPreset = SECURITY_PRESETS.find((p) => deepEqual(p.value, security))?.key;

  return (
    <div>
      <Form layout="vertical" size="small">
        <Form.Item label="安全预设" tooltip="一键套用安全档位，套用后可再展开细调">
          <Select
            value={currentPreset}
            placeholder="选择预设（strict / balanced / permissive）"
            options={SECURITY_PRESETS.map((p) => ({
              value: p.key,
              label: `${p.label} — ${p.description}`,
            }))}
            onChange={(key) => {
              const preset = SECURITY_PRESETS.find((p) => p.key === key);
              if (preset) onChange(preset.value);
            }}
            allowClear
          />
        </Form.Item>
      </Form>
      <Collapse size="small" items={items} />
    </div>
  );
}
