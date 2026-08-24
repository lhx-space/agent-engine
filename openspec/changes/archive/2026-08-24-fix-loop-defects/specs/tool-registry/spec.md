## MODIFIED Requirements

### Requirement: 工具注册与查询

系统 SHALL 提供 `ToolRegistry`，支持 `register`（注册）、`unregister`（按名移除）、`get`（按名查询）、`has`（存在性判断）、`list`（列出全部）。

#### Scenario: 注册与查询

- **WHEN** 向注册表注册一个名为 `get_weather` 的工具
- **THEN** `get('get_weather')` 返回该工具，`has('get_weather')` 为 true

#### Scenario: 查询未注册工具

- **WHEN** 查询一个未注册的工具名
- **THEN** `get` 返回 undefined，`has` 返回 false

#### Scenario: 注销工具

- **WHEN** 对已注册工具名调用 `unregister(name)`
- **THEN** 该工具从注册表移除，`has(name)` 为 false；对未注册名调用返回 false 且无副作用

#### Scenario: 重名注册

- **WHEN** 注册两个同名工具
- **THEN** 抛错或后者覆盖（按注册表约定），行为可预期
