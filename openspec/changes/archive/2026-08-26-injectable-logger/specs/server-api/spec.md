## MODIFIED Requirements

### Requirement: 结构化日志

server SHALL 提供 `Logger` 接口（`info` / `warn` / `error` / `debug`，均接收 `(obj, msg?)`）与 `consoleLogger` 默认实现（console 输出）；`createApp` 的 `options.logger` SHALL 接受任意 `Logger` 实现（缺省 `consoleLogger`），使 pino / winston / OTel 等日志后端经 options 或插件（AOP）接入，不内置锁定。运行时错误与流式事件 SHALL 经注入的 logger 输出。

#### Scenario: 默认 console 日志

- **WHEN** 不注入 `options.logger`
- **THEN** 使用 `consoleLogger`（console 输出），不依赖 pino

#### Scenario: 注入自定义 logger

- **WHEN** `createApp({ logger: 自定义 Logger })`
- **THEN** 运行时错误/事件走该 logger（如 pino 实例）
