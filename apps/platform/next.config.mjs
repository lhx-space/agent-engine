/** @type {import('next').NextConfig} */
const nextConfig = {
  // workspace 包是 ESM + dist 产物，需让 Next 转译（monorepo 符号链接包不进默认编译）。
  transpilePackages: [
    '@lhx-agent-engine/core',
    '@lhx-agent-engine/config',
    '@lhx-agent-engine/preset-default',
    '@lhx-agent-engine/plugin-pgvector',
    '@lhx-agent-engine/plugin-files',
    '@lhx-agent-engine/plugin-documents',
    '@lhx-agent-engine/plugin-web',
    '@lhx-agent-engine/plugin-rules',
    '@lhx-agent-engine/plugin-skills',
    '@lhx-agent-engine/plugin-guardrails',
    '@lhx-agent-engine/plugin-mcp',
  ],
  // drizzle-orm / pg 走 Node 原生 require，不参与打包。
  serverExternalPackages: ['drizzle-orm', 'pg'],
};

export default nextConfig;
