/** guardrail 校验上下文。beforeToolCall 时含 toolName/args，afterToolCall 时含 toolName/result。 */
export interface GuardrailContext {
  toolName?: string;
  args?: string;
  result?: string;
}

/** guardrail 校验结果。allowed=false 表示阻断。 */
export interface GuardrailResult {
  allowed: boolean;
  /** 阻断原因。 */
  reason?: string;
}

/** guardrail 规则实现（由内置规则或插件提供，按 id 与配置声明匹配）。 */
export interface GuardrailRule {
  id: string;
  /** 触发节点，首版支持工具节点。 */
  on: 'beforeToolCall' | 'afterToolCall';
  validate(ctx: GuardrailContext): Promise<GuardrailResult>;
}
