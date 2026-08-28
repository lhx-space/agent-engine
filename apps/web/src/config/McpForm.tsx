import { Button, Empty, Input, Select, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { McpServer, McpServerSource } from '@lhx-agent-engine/config/schema';
import { KeyValueEditor, type KVEntry } from './KeyValueEditor';

const SOURCES: McpServerSource[] = ['command', 'registry', 'http'];

interface McpFormProps {
  servers: McpServer[];
  onChange: (next: McpServer[]) => void;
}

function toKv(env: Record<string, string> | undefined): KVEntry[] {
  return Object.entries(env ?? {}).map(([key, value]) => ({ key, value }));
}

function fromKv(entries: KVEntry[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const { key, value } of entries) {
    if (key) env[key] = value;
  }
  return env;
}

export function McpForm({ servers, onChange }: McpFormProps) {
  const set = (index: number, patch: Partial<McpServer>) =>
    onChange(
      servers.map((server, i) => (i === index ? ({ ...server, ...patch } as McpServer) : server)),
    );
  const setSource = (index: number, source: McpServerSource) =>
    onChange(
      servers.map((server, i) => {
        if (i !== index) return server;
        switch (source) {
          case 'command':
            return { name: server.name, source, command: '', args: [], env: server.env };
          case 'registry':
            return { name: server.name, source, package: '', args: [], env: server.env };
          case 'http':
            return {
              name: server.name,
              source,
              url: '',
              transport: 'streamable-http',
              headers: {},
              env: server.env,
            };
        }
      }),
    );
  const remove = (index: number) => onChange(servers.filter((_, i) => i !== index));
  const add = () =>
    onChange([...servers, { name: '', source: 'registry', package: '', args: [], env: {} }]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {servers.length === 0 && (
        <Empty
          description="还没有 MCP server。可从本地命令或官方 registry/npm 包接入外部能力"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
      {servers.map((server, index) => (
        <div key={index} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="name（唯一标识，如 github）"
                value={server.name}
                onChange={(e) => set(index, { name: e.target.value } as Partial<McpServer>)}
                style={{ width: '40%' }}
              />
              <Select
                value={server.source}
                options={SOURCES.map((source) => ({ value: source, label: source }))}
                onChange={(source) => setSource(index, source)}
                style={{ width: 130 }}
              />
            </Space.Compact>
            {server.source === 'command' && (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="command（如 npx / node）"
                  value={server.command}
                  onChange={(e) => set(index, { command: e.target.value } as Partial<McpServer>)}
                />
                <Select
                  mode="tags"
                  value={server.args}
                  onChange={(args) => set(index, { args } as Partial<McpServer>)}
                  placeholder="args（回车添加）"
                  open={false}
                  suffixIcon={null}
                  style={{ width: '50%' }}
                />
              </Space.Compact>
            )}
            {server.source === 'registry' && (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="package（如 @modelcontextprotocol/server-github）"
                  value={server.package}
                  onChange={(e) => set(index, { package: e.target.value } as Partial<McpServer>)}
                />
                <Select
                  mode="tags"
                  value={server.args}
                  onChange={(args) => set(index, { args } as Partial<McpServer>)}
                  placeholder="额外 args（回车添加）"
                  open={false}
                  suffixIcon={null}
                  style={{ width: '50%' }}
                />
              </Space.Compact>
            )}
            {server.source === 'http' && (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Input
                  placeholder="url（如 https://api.githubcopilot.com/mcp/）"
                  value={server.url}
                  onChange={(e) => set(index, { url: e.target.value } as Partial<McpServer>)}
                />
                <Select
                  value={server.transport}
                  options={[
                    { value: 'streamable-http', label: 'streamable-http' },
                    { value: 'sse', label: 'sse' },
                  ]}
                  onChange={(transport) => set(index, { transport } as Partial<McpServer>)}
                  style={{ width: 180 }}
                />
                <KeyValueEditor
                  entries={toKv(server.headers)}
                  onChange={(entries) =>
                    set(index, { headers: fromKv(entries) } as Partial<McpServer>)
                  }
                  keyPlaceholder="header key（如 Authorization）"
                  valuePlaceholder="值（如 Bearer ${TOKEN}）"
                  addLabel="添加 header"
                />
              </Space>
            )}
            <KeyValueEditor
              entries={toKv(server.env)}
              onChange={(entries) => set(index, { env: fromKv(entries) } as Partial<McpServer>)}
              keyPlaceholder="env key（如 GITHUB_TOKEN）"
              valuePlaceholder="值（如 ${GITHUB_TOKEN}）"
              addLabel="添加 env"
            />
            <Button
              size="small"
              danger
              icon={<MinusCircleOutlined />}
              onClick={() => remove(index)}
            >
              删除 server
            </Button>
          </Space>
        </div>
      ))}
      <Button type="dashed" block icon={<PlusOutlined />} onClick={add}>
        添加 MCP server
      </Button>
    </Space>
  );
}
