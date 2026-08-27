import type { ReactNode } from 'react';

export const metadata = {
  title: 'Agent Engine · Next.js Host',
  description: '扫 .lhx-agent/<name>/ 目录 → 运行时构建协议 → 调内核运行',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
