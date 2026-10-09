## ADDED Requirements

### Requirement: 版本化迁移机制

引擎存储层 SHALL 提供版本化迁移机制：迁移以 `migrations/` 目录下的有序文件声明（每项含 `version`、`name`、`up`），并以 `agent_schema_migrations(version, name, applied_at)` 表记录已应用版本。存储后端初始化时 SHALL 按序应用所有未执行的迁移，已应用的 SHALL 跳过。

#### Scenario: 新库一次性建表

- **WHEN** 对空库执行初始化
- **THEN** 全部迁移按版本号升序应用，`agent_schema_migrations` 中记录全部 version，且表结构完整

#### Scenario: 已存在库增量升级

- **WHEN** 库已应用 v1、当前代码含 v2
- **THEN** 仅应用 v2，v1 被跳过，已有数据不丢失

#### Scenario: 重复启动幂等

- **WHEN** 同一版本已被应用后再次启动
- **THEN** 不重复执行任何迁移，表结构与数据不变

### Requirement: 迁移失败可诊断且中止

单条迁移 SHALL 在自己的事务中执行；任一迁移失败时，初始化 SHALL 中止并抛出包含 `version`、`name` 与错误原因的异常，不得继续以半升级的 schema 对外提供服务。

#### Scenario: 迁移 SQL 报错

- **WHEN** v2 迁移执行中途 SQL 报错
- **THEN** 该迁移整体回滚，错误信息含 `version=2` 与迁移名，且不继续应用 v3

### Requirement: 迁移仅向前、回滚靠手工

迁移 SHALL 只实现 `up` 方向；不提供自动 down。回滚 SHALL 由运维按迁移文件手工逆向执行，迁移文件 SHALL 以注释标注对应的逆向 SQL。

#### Scenario: 需要回退

- **WHEN** 需要将已应用的 v2 回退
- **THEN** 迁移文件注释中提供逆向 SQL，运维手工执行，系统本身不自动回滚
