# 部署指南

> 本文档覆盖本地开发、测试环境、生产环境的完整部署流程，以及配置管理、发布与回滚规范。

## 目录

1. 环境划分
2. 基础设施
3. 环境变量与配置管理
4. 本地启动
5. 云端部署
6. 发布流程
7. 回滚与应急

## 一、环境划分

| 环境      | 用途               | 数据                | 稳定性     |
| --------- | ------------------ | ------------------- | ---------- |
| 本地 dev  | 日常开发           | 本地 `.data/`       | 可随时重置 |
| 测试 test | 集成测试、评审演示 | 测试库              | 可回滚     |
| 生产 prod | 线上服务           | 生产库（备份+归档） | SLO 99.9%  |

## 二、基础设施

| 服务                  | 镜像                           | 端口 | 用途              |
| --------------------- | ------------------------------ | ---- | ----------------- |
| PostgreSQL + pgvector | `pgvector/pgvector:pg16`       | 5432 | 长期记忆向量后端  |
| Redis                 | `redis:7-alpine`               | 6379 | 缓存              |
| 沙箱                  | `agent-engine/sandbox`（自建） | —    | bash/git 隔离执行 |

本地一键启动：

```bash
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
```

数据落在项目根 `.data/`（已 gitignore），`rm -rf .data` 可重置。

## 三、环境变量与配置管理

### 3.1 环境变量清单

| 变量               | 用途                       | 必填 | 示例                                          |
| ------------------ | -------------------------- | ---- | --------------------------------------------- |
| `WORKSPACE_ROOT`   | files 可读写根、沙箱挂载源 | ✅   | `/Users/luhanxin/Desktop/agent-engine`        |
| `DEEPSEEK_API_KEY` | 默认 LLM                   | ✅   | `sk-...`                                      |
| `OPENAI_API_KEY`   | 备用模型 / embedding       | 按需 | `sk-...`                                      |
| `DATABASE_URL`     | 长期记忆后端               | 按需 | `postgres://agent:agent@localhost:5432/agent` |
| `REDIS_URL`        | 缓存后端                   | 按需 | `redis://localhost:6379`                      |

### 3.2 配置原则

- 密钥经环境变量注入，**禁止硬编码 / 提交仓库**。
- 本地开发用 `agents/.env.local`（gitignore），模板见 `agents/.env.example`。
- 生产配置由密钥系统 / 部署平台注入，配置与代码分离。

## 四、本地启动

```bash
# 1. 起基础设施 + 构建沙箱镜像
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d

# 2. 配置 .env.local（复制 .env.example 改路径）
cp agents/.env.example agents/.env.local
# 编辑 agents/.env.local，设 WORKSPACE_ROOT=/你的仓库路径

# 3. 启动宿主
pnpm --filter @lhx-agent-engine/host dev

# 4. 浏览器打开 http://localhost:3000
```

验证：首页应列出 `.lhx-agent/` 下的 agent；对话页能流式输出；写文件 / git / bash 能正常执行（需沙箱镜像已构建）。

## 五、云端部署

- 代码经卷挂载到容器 `/workspace`，设 `WORKSPACE_ROOT=/workspace`。
- server 提供 HTTP API（`POST /api/agent/run` / `run/stream`），web 提供对话 UI。
- 基础设施（pgvector/redis）走云托管或同 compose，连接串经环境变量注入。

## 六、发布流程

1. 合并到 main 触发 CI（lint → typecheck → spell → test → build）。
2. 构建镜像并推送，打 `latest` 与 `git-sha` 双 tag。
3. 灰度发布：10% → 观察 30 分钟 → 50% → 观察 → 100%。
4. 观察指标：错误率、P99 延迟、CPU/内存、业务指标。
5. 异常即回滚。

## 七、回滚与应急

- 回滚命令：`kubectl rollout undo deployment/<name>`，或切回上一个镜像 tag。
- 回滚优先于排查：先恢复服务，再定位根因。
- 回滚后保留现场（日志、快照）用于复盘。
