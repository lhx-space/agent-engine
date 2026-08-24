## MODIFIED Requirements

### Requirement: datetime 工具

系统 SHALL 提供 `datetime` 内置工具，基于原生 `Date` / `Intl` 支持 `now`（当前时间）/ `format`（时间戳格式化）/ `parse`（字符串解析）三种 action。

#### Scenario: now

- **WHEN** 调用 `action: now`
- **THEN** 返回当前时间戳与 ISO 字符串

#### Scenario: format

- **WHEN** 调用 `action: format` 传入时间戳（可含 `timeZone` / `locale`）
- **THEN** 返回格式化后的本地化字符串，且 SHALL 包含星期、日期与时分秒（完整输出，避免模型反复追问）
