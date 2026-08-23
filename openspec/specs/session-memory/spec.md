# session-memory Specification

## Purpose

TBD - created by archiving change add-session-memory. Update Purpose after archive.

## Requirements

### Requirement: 会话历史管理

系统 SHALL 提供 `ConversationMemory`，保存会话消息历史（user / assistant / tool），支持 `push` / `append` 追加、`getMessages` 读取（返回副本）、`size` 计数、`clear` 清空。

#### Scenario: 追加与读取

- **WHEN** 依次 push / append 若干消息
- **THEN** `getMessages` 按追加顺序返回全部消息，`size` 等于条数

#### Scenario: 清空

- **WHEN** 调用 `clear`
- **THEN** 历史清空，`size` 为 0

#### Scenario: 读取返回副本

- **WHEN** 修改 `getMessages` 返回的数组
- **THEN** 不影响内部历史

### Requirement: 窗口裁剪

系统 SHALL 支持 `maxMessages` 限制；历史条数超过 `maxMessages` 时保留最近 `maxMessages` 条（丢弃最旧）；未设置或非正数时不裁剪。

#### Scenario: 超限保留最近 N 条

- **WHEN** `maxMessages=3` 且追加 4 条消息
- **THEN** 保留最近 3 条，最旧 1 条被丢弃

#### Scenario: 未设置不裁剪

- **WHEN** 未设置 `maxMessages`
- **THEN** 历史无限累积，不裁剪
