# 线上故障排查 Runbook

> 本文档是生产环境故障响应的标准操作手册。所有值班同学在收到告警后，必须严格按本文档执行。文档持续沉淀真实案例，每次复盘后更新。

## 目录

1. 故障响应体系
2. 定级与升级机制
3. 止损优先原则
4. 常见故障排查手册
5. 止损工具与手段
6. 复盘规范与模板
7. 附录：常用排查命令

---

## 一、故障响应体系

### 1.1 值班制度

- 实行 7×24 小时 oncall 轮值，每周轮换一次，周五交接。
- 值班期间必须保持手机畅通，收到告警后 **5 分钟内响应**（在告警群回复「收到」）。
- 交接内容包括：本周故障摘要、未闭环事项、已知风险、下周值班注意事项。

### 1.2 响应流程

````text
告警触发 → 值班确认（5min）→ 定级 → 止损 → 定位根因 → 修复验证 → 复盘
```text

关键原则：**任何时候，止损优先于定位**。宁可先回滚一个「不完美」的版本，也不要带着故障慢慢查根因。

### 1.3 沟通规范

- 故障期间统一在 `#incident` 频道同步进展，格式：`【故障】时间 | 影响范围 | 当前动作 | 预计恢复时间 | 需要协助`
- 每 30 分钟同步一次进展，P0/P1 故障每 15 分钟同步。
- 对外口径由指定发言人统一发布，其他人不得私自对外承诺。

## 二、定级与升级机制

### 2.1 定级标准

| 级别 | 定义 | 示例 | 响应时限 |
| --- | --- | --- | --- |
| P0 | 核心链路不可用、数据丢失、资金损失 | 支付失败、全站 502 | 立即响应，全员拉群 |
| P1 | 核心功能受损但不影响主流程 | 搜索延迟飙高、部分下单失败 | 5 分钟响应 |
| P2 | 非核心功能异常 | 报表查询慢、后台页报错 | 15 分钟响应 |
| P3 | 轻微异常、体验问题 | 样式错乱、文案错误 | 正常排期 |

### 2.2 升级机制

- P0：直接拉值班 + 技术负责人 + 业务负责人进群，无需走流程。
- P1 持续 30 分钟未解决：升级到技术负责人。
- P1 持续 1 小时未解决：升级到部门负责人，评估是否启动「战时机制」（停止需求开发，全员支援）。
- 任何级别故障，值班同学判断「超出个人能力范围」时，随时可升级，不丢人。

## 三、止损优先原则

### 3.1 止损动作优先级（代价从小到大）

1. **功能开关**：关闭异常 feature（如果上线了 feature flag）。
2. **切流量**：灰度比例调到 0%，或切到备用集群/机房。
3. **回滚**：回滚到上一个稳定版本镜像。
4. **熔断降级**：对非核心依赖做熔断，降级到兜底逻辑。
5. **限流**：对入口做限流，保护后端不被冲垮。

### 3.2 止损决策树

```text
能定位到是「某次发布」导致的？
  ├─ 是 → 立即回滚该发布
  └─ 否 → 判断影响面
         ├─ 全链路 → 切备用集群 / 全局降级
         └─ 局部 → 关闭对应 feature / 熔断对应依赖
```text

## 四、常见故障排查手册

### 4.1 服务 502 / 504（网关到后端不通）

**现象**：用户访问报 502 Bad Gateway / 504 Gateway Timeout。

**排查步骤**：

```bash
# ① 看 Pod 状态（CrashLoopBackOff / Pending / NotReady / OOMKilled）
kubectl get pods -n <namespace> -o wide

# ② 看 Pod 事件（镜像拉取失败 / 资源不足 / 探针失败 / 节点异常）
kubectl describe pod <pod> -n <namespace> | tail -40

# ③ 看容器日志（含上一次崩溃的日志）
kubectl logs <pod> -n <namespace> --tail=200 --previous

# ④ 看 ingress / 网关日志（是否后端健康检查失败）
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=100
```text

**常见根因与止血**：

| 根因 | 判定 | 止血 | 根治 |
| --- | --- | --- | --- |
| 健康检查探针配置过严 | Pod 反复重启 | 临时放宽探针阈值 | 调整探针为「就绪」与「存活」分离 |
| 资源配额耗尽 | describe 显示 OOMKilled / 调度失败 | 调大 limit / 扩容副本 | 优化内存、加 HPA |
| 滚动更新副本不足 | 发布期间 502 | 回滚发布 | 用 maxSurge 保证滚动期间容量 |
| 后端超时 | 504 而非 502 | 调大网关超时（临时） | 优化慢接口、加缓存 |

### 4.2 数据库连接超时 / 连接池耗尽

**现象**：接口报 `connection timeout`、`too many clients`。

**排查步骤**：

```bash
# ① 当前连接数与上限
psql -h <host> -U agent -d agent -c "SELECT count(*) AS current, (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max FROM pg_stat_activity;"

# ② 长事务（超过 30 秒未提交的活跃事务）
psql -h <host> -U agent -d agent -c "SELECT pid, now()-xact_start AS duration, state, query FROM pg_stat_activity WHERE state='active' AND now()-xact_start > interval '30 seconds' ORDER BY duration DESC;"

# ③ 等待中的连接（阻塞来源）
psql -h <host> -U agent -d agent -c "SELECT pid, wait_event_type, wait_event, query FROM pg_stat_activity WHERE wait_event_type IS NOT NULL;"

# ④ 慢查询（最近 5 分钟）
psql -h <host> -U agent -d agent -c "SELECT query, calls, mean_exec_time, max_exec_time FROM pg_stat_statements ORDER BY max_exec_time DESC LIMIT 20;"
```text

**止血**：

```bash
# 终止指定长事务（确认非关键事务后）
psql -h <host> -U agent -d agent -c "SELECT pg_terminate_backend(<pid>);"
```text

**根治**：连接池上限调大（配合监控）、慢查询加索引 / 改写、长事务加超时自动 kill、读写分离。

### 4.3 缓存击穿 / 雪崩

**现象**：缓存命中率骤降，DB QPS 飙升，接口延迟恶化。

**根因**：

- **击穿**：某个热点 key 过期瞬间，大量并发请求同时打到 DB。
- **雪崩**：大量 key 在同一时间集中过期（如缓存整体失效），DB 被打垮。

**处置**：

1. 热点 key：用「逻辑过期 + 互斥锁重建」——key 值里带逻辑过期时间，物理不过期，发现逻辑过期后由单一线程加锁重建，其他请求返回旧值兜底。
2. 过期时间加随机抖动：`ttl + random(0, 60s)`，避免集中过期。
3. 熔断：DB 访问失败率超阈值时，直接返回缓存旧值 / 兜底数据。

### 4.4 内存泄漏 / OOM

**现象**：Pod 内存持续上涨，触发 OOMKilled 重启。

**排查**：

```bash
# 内存趋势
kubectl top pod <pod> -n <namespace>

# 上次 OOM 状态
kubectl describe pod <pod> -n <namespace> | grep -A5 'Last State'

# 进入容器看进程内存
kubectl exec -it <pod> -n <namespace> -- top -o %MEM
```text

**常见根因**：缓存无上限、大对象未释放、goroutine / 连接泄漏、日志缓冲堆积。

**止血**：重启 + 临时调大 limit；**根治**：定位泄漏点（pprof / 内存快照对比），修复后回退 limit。

### 4.5 发布后错误率飙升

**现象**：发布后 5xx 错误率骤升。

**标准动作**：**立即回滚**，不要在现场 debug。回滚后对比新旧版本差异定位。

```bash
# 快速回滚到上一版本
kubectl rollout undo deployment/<name> -n <namespace>
```text

## 五、止损工具与手段

| 手段 | 适用场景 | 操作 |
| --- | --- | --- |
| Feature flag | 新功能有开关 | 后台关闭开关，秒级生效 |
| 灰度回退 | 正在灰度发布 | 灰度比例调 0% |
| 镜像回滚 | 发布引入 bug | `kubectl rollout undo` |
| 熔断降级 | 依赖不可用 | 打开熔断开关，走兜底 |
| 限流 | 流量洪峰 | 入口限流，保护后端 |
| 切流 | 单机房故障 | DNS / 网关切到备用机房 |

## 六、复盘规范与模板

### 6.1 复盘要求

- 故障恢复后 **24 小时内**完成复盘，P0/P1 必须当面复盘。
- 复盘产出：时间线 + 根因 + 改进项（每条带 owner 和 deadline）。

### 6.2 复盘模板

```markdown
# 故障复盘：<一句话标题>

## 基本信息
- 时间：YYYY-MM-DD HH:MM - HH:MM（持续 X 分钟）
- 级别：P0 / P1 / P2
- 影响：<影响范围、用户数、资损>
- 值班：<名字>

## 时间线（按时间倒序）
- HH:MM 告警触发，现象是……
- HH:MM 值班响应，做了……
- HH:MM 止损完成（回滚 / 切流）
- HH:MM 定位根因
- HH:MM 恢复验证通过

## 根因
<5 Whys 逐层追问，直到可行动的根本原因>

## 改进项
- [ ] <改进项 1> —— owner: @xxx，deadline: YYYY-MM-DD
- [ ] <改进项 2> —— owner: @yyy，deadline: YYYY-MM-DD
```text

## 附录：常用排查命令

```bash
# Pod 与日志
kubectl get pods -n <ns> -o wide
kubectl describe pod <pod> -n <ns>
kubectl logs <pod> -n <ns> --tail=200 --previous
kubectl top pod <pod> -n <ns>

# 数据库
psql -h <host> -U agent -d agent -c "SELECT count(*) FROM pg_stat_activity;"
psql -h <host> -U agent -d agent -c "SELECT pid, now()-xact_start, query FROM pg_stat_activity WHERE now()-xact_start > interval '30s';"

# 缓存
redis-cli -h <host> INFO
redis-cli -h <host> --latency
redis-cli -h <host> MEMORY DOCTOR
```text
````
