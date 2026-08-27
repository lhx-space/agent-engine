import { DownloadOutlined } from '@ant-design/icons';
import { Button, Dropdown, Tabs } from 'antd';
import { exportConfig, type ExportFormat } from '../lib/export-config';
import { buildConfigTabs } from '../panels/ConfigPanel';
import { SystemPromptPanel } from '../panels/SystemPromptPanel';
import { useConfigStore } from '../store/config-store';

/** 配置页：提示词 + 八大配置轴（左侧分组导航）+ 导出。 */
export function ConfigPage() {
  const config = useConfigStore((state) => state.config);
  const setConfig = useConfigStore((state) => state.setConfig);

  const items = [
    {
      key: 'system-prompt',
      label: 'system-prompt',
      children: (
        <SystemPromptPanel
          systemPrompt={config.systemPrompt}
          onChange={(systemPrompt) => setConfig({ ...config, systemPrompt })}
        />
      ),
    },
    ...buildConfigTabs(config, setConfig),
  ];

  return (
    <div className="config-page">
      <div className="config-page__bar">
        <Dropdown
          menu={{
            items: [
              { key: 'yaml', label: '导出 YAML' },
              { key: 'json', label: '导出 JSON' },
            ],
            onClick: ({ key }) => exportConfig(config, key as ExportFormat),
          }}
        >
          <Button icon={<DownloadOutlined />}>导出配置</Button>
        </Dropdown>
      </div>
      <Tabs size="small" tabPosition="left" items={items} />
    </div>
  );
}
