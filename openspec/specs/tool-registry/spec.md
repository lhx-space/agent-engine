# tool-registry Specification

## Purpose

TBD - created by archiving change add-tool-registry. Update Purpose after archive.

## Requirements

### Requirement: Tool 接口

系统 SHALL 定义 `Tool` 接口，含 `name`（唯一标识）、`description`（供 LLM 理解用途）、`inputSchema`（Zod schema，描述入参）、`execute(input)`（执行并返回结果）。

#### Scenario: 工具实现

- **WHEN** 定义一个实现 `Tool` 接口的对象，提供 name / description / inputSchema / execute
- **THEN** 该对象可被 `ToolRegistry.register` 接受

#### Scenario: 入参由 Zod 约束

- **WHEN** `Tool.inputSchema` 为 `z.object({ city: z.string() })`
- **THEN** 该 schema 既用于运行时校验，也可转换为 JSON Schema 供 LLM 使用

### Requirement: 工具注册与查询

系统 SHALL 提供 `ToolRegistry`，支持 `register`（注册）、`get`（按名查询）、`has`（存在性判断）、`list`（列出全部）。

#### Scenario: 注册与查询

- **WHEN** 向注册表注册一个名为 `get_weather` 的工具
- **THEN** `get('get_weather')` 返回该工具，`has('get_weather')` 为 true

#### Scenario: 查询未注册工具

- **WHEN** 查询一个未注册的工具名
- **THEN** `get` 返回 undefined，`has` 返回 false

#### Scenario: 重名注册

- **WHEN** 注册两个同名工具
- **THEN** 抛错或后者覆盖（按注册表约定），行为可预期

### Requirement: 工具执行（含参数校验）

系统 SHALL 提供 `ToolRegistry.execute(name, argsJson)`：接收 JSON 字符串参数，内部 `JSON.parse` 后经 `inputSchema.parse` 校验，再调用 `Tool.execute`。

#### Scenario: 合法参数执行

- **WHEN** 以合法 JSON 字符串 `{"city":"beijing"}` 调用 `execute('get_weather', ...)`
- **THEN** 参数通过校验，`Tool.execute` 被调用并返回其结果

#### Scenario: 非法参数拒绝

- **WHEN** 参数 JSON 无法通过 `inputSchema` 校验
- **THEN** 抛错且不调用 `Tool.execute`

#### Scenario: 非法 JSON 拒绝

- **WHEN** 参数不是合法 JSON 字符串
- **THEN** 抛错且不调用 `Tool.execute`

### Requirement: Zod → JSON Schema 转换

系统 SHALL 提供将 `Tool` 转为 LLM `ToolDefinition` 的能力，其中 `parameters` 由 `inputSchema` 经 Zod 4 内置 `toJSONSchema` 生成。

#### Scenario: 转换为 ToolDefinition

- **WHEN** 对一个工具调用转换方法（如 `toToolDefinitions()`）
- **THEN** 返回 `ToolDefinition` 数组，每项含 `type: 'function'` 与 `function.name` / `function.description` / `function.parameters`

#### Scenario: parameters 为 JSON Schema

- **WHEN** 工具的 `inputSchema` 为 `z.object({ city: z.string() })`
- **THEN** 生成的 `parameters` 为等价 JSON Schema（含 `type: 'object'` 与 properties）

### Requirement: 错误处理

工具执行或校验失败 SHALL 抛出包含工具名与原因的可读错误。

#### Scenario: 校验失败含工具名

- **WHEN** 某工具的参数校验失败
- **THEN** 抛出的错误信息包含该工具名与 Zod 校验原因
