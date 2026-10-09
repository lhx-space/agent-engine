## ADDED Requirements

### Requirement: 双 schema 与双连接池

平台 SHALL 使用两个逻辑数据库：`engine` schema（引擎运行时资产：向量、记忆、会话）与 `platform` schema（业务资产：市场、安装、agent 实例）。代码 SHALL 通过两个独立连接池访问（`engineDb` / `platformDb`），物理部署允许先指向同一实例的不同 schema，并支持仅改连接串即切换为两个独立库。

#### Scenario: 物理同库逻辑隔离

- **WHEN** 两者指向同一 PostgreSQL 实例的不同 schema
- **THEN** 平台功能正常，且 `platform` 的查询无法访问 `engine` 的表（除显式授权外不使用）

#### Scenario: 切换为独立库

- **WHEN** 修改 `platformDb` 的连接串指向另一个实例
- **THEN** 业务代码无需改动，功能保持正常

### Requirement: 迁移归属与工具边界

`engine` schema 的结构变更 SHALL 只由 `plugin-pgvector` 的自建迁移机制执行；`platform` schema 的结构变更 SHALL 只由 Drizzle + drizzle-kit 执行。两侧 SHALL 互不调用对方的迁移工具，且 `plugin-pgvector` 等内核包 SHALL 不依赖任何 ORM。

#### Scenario: 内核包无 ORM 依赖

- **WHEN** 检查 `packages/plugins/*` 的依赖声明
- **THEN** 不含 drizzle-orm / prisma 等 ORM 依赖

### Requirement: 禁止跨层外键，仅字符串软关联

两层之间 SHALL 仅以字符串 id 关联（平台 `agents.id` ↔ 引擎 `agent_sessions.agent_name`，将来 `runs.session_id` ↔ 引擎 `agent_sessions.id`）。**不得**建立跨 schema 的数据库外键约束；关联一致性由应用层保证。

#### Scenario: 无跨层外键

- **WHEN** 检查数据库约束定义
- **THEN** 不存在引用另一 schema 表的外键

#### Scenario: 跨层查询走应用层

- **WHEN** 平台需要展示某实例的历史会话
- **THEN** 先取平台侧记录的 id，再由应用层去引擎侧查询，数据库层无 join

### Requirement: 单租户占位字段

第一版不做登录与多租户，`agents` / `installations` 等表 SHALL 保留 `userId` 与 `workspaceId` 列并填默认值 `'default'`，但**不建** `users` / `workspaces` 表。后续接入登录时回填这些列。

#### Scenario: 默认值写入

- **WHEN** 第一版创建任意平台记录
- **THEN** `userId` 与 `workspaceId` 均为 `'default'`，且不依赖 users 表存在
