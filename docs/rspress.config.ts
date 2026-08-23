import { defineConfig } from 'rspress/config';

export default defineConfig({
  title: 'Agent Engine',
  description: '通用、可配置化的 Agent 内核执行引擎（配置即 Agent）',
  lang: 'zh-CN',
  themeConfig: {
    socialLinks: [],
    nav: [
      { text: '指南', link: '/guide/', activeMatch: '^/guide/' },
      { text: '架构', link: '/architecture/', activeMatch: '^/architecture/' },
    ],
    sidebar: {
      '/guide/': [
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '配置说明', link: '/guide/configuration' },
      ],
      '/architecture/': [
        { text: '总览', link: '/architecture/overview' },
        { text: '内核执行引擎', link: '/architecture/kernel' },
      ],
    },
  },
});
