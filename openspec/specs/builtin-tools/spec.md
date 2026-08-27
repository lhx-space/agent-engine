# builtin-tools Specification

## Purpose

TBD - created by archiving change 2026-08-24-add-builtin-tools. Update Purpose after archive.

## Requirements

### Requirement: todo 工具

系统 SHALL 提供 `todo` 内置工具，基于内存 `TodoStore`，支持 `add` / `list` / `update` / `delete` 四种 action；入参为**扁平 schema**（`action` 枚举 + `task` / `id` / `status` 可选字段），缺必需字段时执行期抛可读错误；每个 item 含 `id` / `task` / `status`（pending / in_progress / completed）。

#### Scenario: 添加并列出

- **WHEN** 调用 `action: 'add'` 且提供 `task`
- **THEN** 返回新增 item（含自动生成的 `id`、`status: pending`），随后 `action: 'list'` 返回含该 item 的列表

#### Scenario: add 缺 task 报错

- **WHEN** 调用 `action: 'add'` 但未提供 `task`
- **THEN** 抛可读错误，不新增

#### Scenario: 状态流转

- **WHEN** 调用 `action: 'update'` 传入 `id` 与 `status: 'completed'`
- **THEN** 该 item 状态更新，`list` 反映新状态

#### Scenario: 删除

- **WHEN** 调用 `action: 'delete'` 传入存在的 `id`
- **THEN** 该 item 被移除

### Requirement: 内置工具统一装配

系统 SHALL 提供 `registerBuiltinTools(registry, deps?)`：恒注册**两个通用原语** `todo` / `datetime`；返回注册的工具名列表供上层注入规划引导。`read_file` / `write_file` / `bash` 由内置 plugin（`@agent-engine/plugin-files` / `@agent-engine/plugin-bash`）按 `config.plugins` 加载；`web_search` / `web_fetch` 已外放为 `@agent-engine/plugin-web`；`sitesearch` / `calculator` / `json` / `base64` 已彻底移除。

#### Scenario: 默认装配

- **WHEN** 以缺省参数调用 `registerBuiltinTools`
- **THEN** registry 含 `todo` / `datetime`，不含 `read_file` / `write_file` / `bash` / `web_search` / `web_fetch` / `sitesearch` / `calculator` / `json` / `base64`

### Requirement: datetime 工具

系统 SHALL 提供 `datetime` 内置工具，基于原生 `Date` / `Intl` 支持 `now`（当前时间）/ `format`（时间戳格式化）/ `parse`（字符串解析）三种 action；`now` 与 `format` 在提供 `timeZone`/`locale` 时 SHALL 返回 `formatted` 本地化字符串（含星期、日期与时分秒，完整输出，避免模型反复追问）。

#### Scenario: now

- **WHEN** 调用 `action: now`
- **THEN** 返回当前时间戳与 ISO 字符串

#### Scenario: now 本地化

- **WHEN** 调用 `action: now` 并提供 `timeZone`（可含 `locale`）
- **THEN** 返回结果含 `formatted` 字段，为本地化完整串（星期 + 日期 + 时分秒）

#### Scenario: format

- **WHEN** 调用 `action: format` 传入时间戳（可含 `timeZone` / `locale`）
- **THEN** 返回格式化后的本地化字符串，且 SHALL 包含星期、日期与时分秒（完整输出，避免模型反复追问）
