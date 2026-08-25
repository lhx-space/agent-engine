import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    agent: 'src/agent/index.ts',
    cache: 'src/cache/index.ts',
    capability: 'src/capability/index.ts',
    'capability-source': 'src/capability-source/index.ts',
    context: 'src/context/index.ts',
    hooks: 'src/hooks/index.ts',
    llm: 'src/llm/index.ts',
    mcp: 'src/mcp/index.ts',
    memory: 'src/memory/index.ts',
    plugins: 'src/plugins/index.ts',
    resolve: 'src/resolve/index.ts',
    retrieval: 'src/retrieval/index.ts',
    rules: 'src/rules/index.ts',
    sandbox: 'src/sandbox/index.ts',
    skills: 'src/skills/index.ts',
    tools: 'src/tools/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
