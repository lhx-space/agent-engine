import { defineConfig, globals, globalIgnores } from '@rslint/core';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/.rspress/**',
    '**/doc_build/**',
    '**/.rslib/**',
    '**/*.d.ts',
    '**/*.d.mts',
    '**/*.d.cts',
    '**/.work/**',
  ]),

  {
    name: 'javascript',
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    name: 'typescript',
    files: ['**/*.{ts,tsx,mts,cts}'],
    plugins: ['@typescript-eslint'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
    },
  },
]);
