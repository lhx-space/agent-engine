/** @type {import('next').NextConfig} */
const nextConfig = {
  // workspace 包是 ESM + dist 产物，需让 Next 转译（monorepo 符号链接包不进默认编译）。
  transpilePackages: [
    '@agent-engine/core',
    '@agent-engine/config',
    '@agent-engine/preset-default',
    '@agent-engine/plugin-bash',
    '@agent-engine/plugin-documents',
    '@agent-engine/plugin-files',
    '@agent-engine/plugin-git',
    '@agent-engine/plugin-guardrails',
    '@agent-engine/plugin-mcp',
    '@agent-engine/plugin-memory',
    '@agent-engine/plugin-otel',
    '@agent-engine/plugin-rules',
    '@agent-engine/plugin-skills',
    '@agent-engine/plugin-web',
  ],
};

export default nextConfig;
