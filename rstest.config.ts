import { defineConfig } from '@rstest/core';

export default defineConfig({
  include: ['packages/**/tests/**/*.{test,spec}.{ts,tsx}'],
});
