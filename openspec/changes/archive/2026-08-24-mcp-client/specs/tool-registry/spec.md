## MODIFIED Requirements

### Requirement: Tool 接口

系统 SHALL 定义 `Tool` 接口，含 `name`（唯一标识）、`description`（供 LLM 理解用途）、`inputSchema`（Zod schema，描述入参）、可选 `jsonSchema`（原生 JSON Schema，MCP 等外部工具无损透传）、`execute(input)`（执行并返回结果）。

#### Scenario: 工具实现

- **WHEN** 定义一个实现 `Tool` 接口的对象，提供 name / description / inputSchema / execute
- **THEN** 该对象可被 `ToolRegistry.register` 接受

#### Scenario: 入参由 Zod 约束

- **WHEN** `Tool.inputSchema` 为 `z.object({ city: z.string() })`
- **THEN** 该 schema 既用于运行时校验，也可转换为 JSON Schema 供 LLM 使用

#### Scenario: 原生 JSON Schema 透传

- **WHEN** `Tool.jsonSchema` 已提供（MCP 工具）
- **THEN** 对外 tool definition 的 `parameters` 优先使用 `jsonSchema`，而非 `toJSONSchema(inputSchema)`

### Requirement: Zod → JSON Schema 转换

系统 SHALL 提供将 `Tool` 转为 LLM `ToolDefinition` 的能力，其中 `parameters` 优先取 `Tool.jsonSchema`（若提供），否则由 `inputSchema` 经 Zod 4 内置 `toJSONSchema` 生成。

#### Scenario: 转换为 ToolDefinition

- **WHEN** 对一个工具调用转换方法（如 `toToolDefinitions()`）
- **THEN** 返回 `ToolDefinition` 数组，每项含 `type: 'function'` 与 `function.name` / `function.description` / `function.parameters`

#### Scenario: parameters 为 JSON Schema

- **WHEN** 工具的 `inputSchema` 为 `z.object({ city: z.string() })`
- **THEN** 生成的 `parameters` 为等价 JSON Schema（含 `type: 'object'` 与 properties）

#### Scenario: jsonSchema 优先

- **WHEN** 工具同时提供 `inputSchema` 与 `jsonSchema`
- **THEN** 生成的 `parameters` 等于 `jsonSchema`
