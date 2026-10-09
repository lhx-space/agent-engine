# platform-marketplace Specification

## Purpose

TBD - created by archiving change add-platform-marketplace. Update Purpose after archive.

## Requirements

### Requirement: 商品与版本

市场 SHALL 以 `marketplace_items` 描述商品（`type` / `slug` / `name` / `summary` / `visibility` / `status` / `tags` / `latestVersionId`），以 `marketplace_versions` 描述不可变版本（`version` / `manifest` jsonb / `readme` / `changelog`）。

第一版 `type` SHALL 仅支持 `agent` 与 `skill`；其余类型后续沿用同一模型扩展，不改表。版本一经发布 SHALL 不可变，更新内容必须发新版本。

#### Scenario: 发布新版本

- **WHEN** 已发布 v1.0.0 的 item 再次发布
- **THEN** 创建新的 version 记录，v1.0.0 的 manifest 保持不变，`latest_version_id` 指向新版本

#### Scenario: 上架类型限制

- **WHEN** 尝试上架 `type='plugin'` 的商品
- **THEN** 被拒绝，并提示第一版仅支持 agent 与 skill

### Requirement: 安装与实例化

安装 SHALL 产生 `installations` 记录（workspaceId / itemId / versionId / configOverrides / enabled）；随后生成 `agents` 行作为实例，实例的最终配置 SHALL 为「版本 manifest 合并 configOverrides」的结果。

实例配置 SHALL 可被编辑（覆写），且覆写不得修改原版本 manifest。

#### Scenario: 安装后得到可运行实例

- **WHEN** 安装某 item 的 v1.2.0
- **THEN** 生成一条 installation 与一条 agent，agent 的 config 等于该版本 manifest

#### Scenario: 覆写实例配置

- **WHEN** 修改实例 config 的模型配置
- **THEN** 实例生效新配置，item 的 v1.2.0 manifest 不受影响

### Requirement: manifest 校验

写入与读取 manifest 时 SHALL 使用 `AgentConfigSchema`（Zod）校验；校验失败 SHALL 明确报错，读取历史版本校验失败时降级为「只读 + 需升级」提示，不得阻断列表渲染。

#### Scenario: 非法 manifest 拒绝写入

- **WHEN** 提交的 manifest 未通过 Zod 校验
- **THEN** 拒绝并给出字段级错误信息

#### Scenario: 旧版本校验失败可浏览

- **WHEN** 某历史版本的 manifest 与新 Schema 不兼容
- **THEN** 该版本在列表中可见但标记为需升级，不可用于安装

### Requirement: 平台不支持可执行 hook

平台侧 agent SHALL 仅支持声明式 hook 与 webhook；**不得**加载或执行用户提供的 TypeScript/JavaScript hook 代码。依赖 TS hook 的 agent SHALL 被标记为「仅自托管可用」。

#### Scenario: 导入含 TS hook 的目录

- **WHEN** 从目录导入一个含 `hooks/*.ts` 的 agent
- **THEN** 该 hook 被忽略并明确提示平台不支持，其余配置正常导入

### Requirement: 知识库文档存储

`agent_documents` SHALL 以 text 列直接存储文档正文与元信息（名称、大小、创建时间），供文档检索装载使用；第一版不引入对象存储。

#### Scenario: 上传并检索文档

- **WHEN** 为实例上传一份 md 文档并运行问答
- **THEN** 文档内容可被检索插件装载并参与召回
