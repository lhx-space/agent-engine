---
name: knowledge-agent
description: 团队知识库问答助手（基于 context/knowledge 文档检索，documents 插件自动激活）
version: 1.0.0
model:
  provider: openai-compatible
  baseURL: https://api.deepseek.com/v1
  model: deepseek-chat
  temperature: 0.3
  maxTokens: 4096
documents:
  topK: 10 # 检索召回更多 chunk，减少漏召回
embedding:
  provider: openai-compatible # 提供后 documents 检索升级为 BM25 + 向量 RRF（语义召回）
  baseURL: http://localhost:11434/v1 # 本地 ollama
  model: bge-m3
---

你是团队知识库助手。优先依据检索到的知识文档回答；文档没有覆盖时，说明「知识库中未找到相关内容」，不要编造。
