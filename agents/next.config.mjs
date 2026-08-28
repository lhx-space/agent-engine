/** @type {import('next').NextConfig} */
const nextConfig = {
  // workspace 包是 ESM + dist 产物，需让 Next 转译（monorepo 符号链接包不进默认编译）。
  transpilePackages: [
    '@lhx-agent-engine/core',
    '@lhx-agent-engine/config',
    '@lhx-agent-engine/preset-default',
    '@lhx-agent-engine/plugin-bash',
    '@lhx-agent-engine/plugin-documents',
    '@lhx-agent-engine/plugin-files',
    '@lhx-agent-engine/plugin-git',
    '@lhx-agent-engine/plugin-guardrails',
    '@lhx-agent-engine/plugin-mcp',
    '@lhx-agent-engine/plugin-memory',
    '@lhx-agent-engine/plugin-otel',
    '@lhx-agent-engine/plugin-rules',
    '@lhx-agent-engine/plugin-skills',
    '@lhx-agent-engine/plugin-web',
  ],
};

export default nextConfig;
