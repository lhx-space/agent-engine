# 后端 API 规范

> 本文档定义 API 的设计约定、错误码、分页、幂等与版本管理。所有新接口必须符合本文档。

## 目录

1. 通用约定
2. 端点清单
3. 请求与响应格式
4. 错误码与错误处理
5. 分页与幂等
6. 版本管理

## 一、通用约定

- 统一返回 JSON；错误统一返回 `{ "error": string }`。
- 认证头：`Authorization: Bearer <token>`。
- 命名：URL 用复数名词 + 小写连字符（`/api/agents`）；字段 camelCase。

## 二、端点清单

### 2.1 健康检查

````text
GET /health
→ 200 { "ok": true }
```text

### 2.2 列出 agents

```text
GET /api/agents
→ 200 { "agents": [{ "name": "devops-agent", "description": "..." }] }
```text

### 2.3 运行 agent（非流式）

```text
POST /api/agent/run
body: { "config": {...}, "input": "...", "sessionId": "..." }
→ 200 { "sessionId": "...", "finalMessage": {...}, "steps": 1, "outcome": "completed" }
```text

### 2.4 运行 agent（流式）

```text
POST /api/agent/run/stream
body: { "config": {...}, "input": "..." }
→ 200 NDJSON（每行一个 AgentRunEvent）
```text

AgentRunEvent 类型：`step_start` / `llm_delta` / `tool_call` / `tool_result` / `done` / `error`。

### 2.5 结束会话

```text
DELETE /api/agent/sessions/:id
→ 200 { "ok": true }
```text

## 三、请求与响应格式

### 3.1 请求

- `Content-Type: application/json`。
- 对象 body 由客户端序列化，服务端 Zod 校验。

### 3.2 响应

- 成功：`2xx` + 业务数据。
- 流式：`application/x-ndjson`，每行一个 JSON 事件，`Cache-Control: no-cache`。

## 四、错误码与错误处理

| 状态码 | 语义 | 返回 |
| --- | --- | --- |
| 400 | 参数错误 | `{ "error": "input is required" }` |
| 401 | 未认证 | `{ "error": "unauthorized" }` |
| 404 | 资源不存在 | `{ "error": "agent not found" }` |
| 500 | 服务内部错误 | `{ "error": "<可读错误信息>" }` |

- 错误信息可读、可定位，不暴露堆栈 / 内部实现 / 密钥。
- 装配失败、工具失败、LLM 失败分别给可读错误，不吞异常。

## 五、分页与幂等

### 5.1 分页

```text
GET /api/resources?page=1&pageSize=20
→ { "items": [...], "total": 128, "page": 1, "pageSize": 20 }
```text

### 5.2 幂等

- 写操作支持幂等：提供 `idempotency-key` 头或客户端生成唯一 id。
- 重复提交不产生副作用（同一 id 返回首次结果）。

## 六、版本管理

- 破坏性变更升级主版本（`/api/v2/...`）。
- 兼容性变更（加字段）保持原版本，旧客户端不受影响。
- 废弃接口保留至少一个版本过渡期，文档标注 deprecation。
````
