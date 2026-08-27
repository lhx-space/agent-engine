import { BulbFilled, BulbOutlined, MessageOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/theme-store';

const { Sider, Header, Content } = Layout;

/** 全局布局：左侧可折叠导航 + 顶栏（标题 + 主题切换）+ 内容区。 */
export function AppLayout() {
  const { mode, toggle } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname.startsWith('/config') ? '/config' : '/';

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider breakpoint="lg" collapsible theme="dark" width={220}>
        <div className="app-logo">Agent Engine</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/', icon: <MessageOutlined />, label: '对话' },
            { key: '/config', icon: <SettingOutlined />, label: 'Agent 配置' },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Text className="app-header__title">配置即 Agent</Typography.Text>
          <Button
            type="text"
            icon={mode === 'dark' ? <BulbFilled /> : <BulbOutlined />}
            onClick={toggle}
          >
            {mode === 'dark' ? '暗色' : '浅色'}
          </Button>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
