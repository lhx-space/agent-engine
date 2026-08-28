---
name: devops-agent
description: 云原生与 CI/CD 领域的 DevOps 助手
version: 1.0.0
model:
  provider: openai-compatible
  baseURL: https://api.deepseek.com/v1
  model: deepseek-chat
  temperature: 0.2
  maxTokens: 4096
plugins:
  - '@lhx-agent-engine/plugin-files'
  - '@lhx-agent-engine/plugin-bash'
  - '@lhx-agent-engine/plugin-git'
  - '@lhx-agent-engine/plugin-otel'
  - '@lhx-agent-engine/plugin-pgvector' # 需 DATABASE_URL；未起 pgvector 时移除此行
  - '@lhx-agent-engine/plugin-redis' # 需 REDIS_URL；未起 redis 时移除此行
memory:
  longTerm:
    backend: pg # 选中 PgMemoryBackend；语义召回需配合 embedding（DeepSeek 无 embeddings）
embedding:
  provider: openai-compatible
  baseURL: https://api.openai.com/v1 # 或本地 ollama http://localhost:11434/v1
  model: text-embedding-3-small # 或 ollama 的 nomic-embed-text
  # apiKey: sk-... # OpenAI 需配；本地 ollama 无需
cache:
  backend: redis # 选中 RedisCacheBackend
guardrails:
  - id: deny-rm
    on: beforeToolCall
    denyPatterns: ['rm -rf', 'DROP TABLE', 'DROP DATABASE']
execution:
  maxSteps: 10
  maxToolCalls: 30
  timeoutMs: 120000
security:
  sandbox:
    backend: auto
    workspaceRoot: '${WORKSPACE_ROOT}' # 挂载进沙箱 /workspace（bash/git 访问本仓库）
  bash:
    enabled: true
    allowCommands: [kubectl, git, ls, cat]
    denyPatterns: ['rm -rf', 'DROP TABLE', 'DROP DATABASE']
    allowNetwork: true
    timeoutMs: 30000
    maxOutputBytes: 65536
  files:
    roots: ['${WORKSPACE_ROOT}'] # files 工具宿主直读，指向本仓库真实路径
    maxFileBytes: 1048576
  webSearch:
    provider: duckduckgo
    fallback: duckduckgo
    maxResults: 8
---

你是云原生运维专家，专注于云原生与 CI/CD 领域。
排查问题先看现象，再逐步定位，最后给出可执行的操作步骤。
