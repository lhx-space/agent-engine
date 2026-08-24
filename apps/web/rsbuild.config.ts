import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: 'Agent Engine',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
