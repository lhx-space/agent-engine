'use client';

import { ConfigProvider, Layout } from 'antd';
import Link from 'next/link';
import { Typography } from 'antd';

/** antd 需在客户端边界内使用（v6 依赖 hooks/context），故单独抽出 provider。 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ color: '#fff' }}>
            <Typography.Title level={5} style={{ color: '#fff', margin: 0 }}>
              Agent Engine 平台
            </Typography.Title>
          </Link>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>{children}</Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
