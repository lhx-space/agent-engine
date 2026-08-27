import { App as AntApp, ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ChatPage } from './pages/ChatPage';
import { ConfigPage } from './pages/ConfigPage';
import { useThemeStore } from './store/theme-store';

export function App() {
  const mode = useThemeStore((state) => state.mode);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        cssVar: { key: 'ant' },
        algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <AntApp>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<ChatPage />} />
              <Route path="/config" element={<ConfigPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
}
