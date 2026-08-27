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
  - '@agent-engine/plugin-files'
  - '@agent-engine/plugin-bash'
  - '@agent-engine/plugin-git'
  - '@agent-engine/plugin-otel'
guardrails:
  - id: deny-rm
    on: beforeToolCall
    denyPatterns: ['rm -rf', 'DROP TABLE', 'DROP DATABASE']
execution:
  maxSteps: 10
  maxToolCalls: 30
  timeoutMs: 120000
security:
  bash:
    enabled: true
    allowCommands: [kubectl, git, ls, cat]
    denyPatterns: ['rm -rf', 'DROP TABLE', 'DROP DATABASE']
    allowNetwork: true
    timeoutMs: 30000
    maxOutputBytes: 65536
  files:
    roots: [/workspace]
    maxFileBytes: 1048576
  webSearch:
    provider: duckduckgo
    fallback: duckduckgo
    maxResults: 8
---

你是云原生运维专家，专注于云原生与 CI/CD 领域。
排查问题先看现象，再逐步定位，最后给出可执行的操作步骤。
