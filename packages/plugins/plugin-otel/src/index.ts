import type { Hook } from '@lhx-agent-engine/core/hooks';
import type { Plugin } from '@lhx-agent-engine/core/plugins';
import type { Span, SpanStatusCode, Tracer } from '@opentelemetry/api';

/** 对齐 `@opentelemetry/api` 的 `SpanStatusCode.ERROR`（2）；type-only 引用，避免运行时加载其 ESM 构建。 */
const SPAN_STATUS_ERROR = 2 as SpanStatusCode;

/** `createOtelPlugin` 的可选配置。 */
export interface OtelPluginOptions {
  /** OTel tracer 名（默认 `@lhx-agent-engine/plugin-otel`；仅未注入 `tracer` 时生效）。 */
  tracerName?: string;
  /** 注入的 OTel tracer（测试 / 自定义场景）；缺省时在 install 阶段经全局 `trace.getTracer` 惰性获取。 */
  tracer?: Tracer;
}

/**
 * 在 `startActiveSpan` 的活跃 span 内执行 `record`；异常时记录异常并置 `status=ERROR`，
 * 最后总是 `span.end()`。
 */
async function withSpan(
  tracer: Tracer,
  name: string,
  record: (span: Span) => void | Promise<void>,
): Promise<void> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      await record(span);
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({ code: SPAN_STATUS_ERROR, message: error.message });
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

/** 把 10 个生命周期 hook 点映射为 OTel span（纯观察，不改写入参）。 */
function createOtelHook(tracer: Tracer): Hook {
  return {
    name: '@lhx-agent-engine/plugin-otel',
    async onInit() {
      await withSpan(tracer, 'agent.init', (span) => {
        span.setAttribute('agent.hook.point', 'onInit');
      });
    },
    async onSessionStart() {
      await withSpan(tracer, 'agent.session.start', (span) => {
        span.setAttribute('agent.hook.point', 'onSessionStart');
      });
    },
    async onSessionEnd() {
      await withSpan(tracer, 'agent.session.end', (span) => {
        span.setAttribute('agent.hook.point', 'onSessionEnd');
      });
    },
    async beforeContextCompose(userInput) {
      await withSpan(tracer, 'agent.context.compose', (span) => {
        span.setAttribute('agent.hook.point', 'beforeContextCompose');
        span.setAttribute('agent.input.length', userInput.length);
      });
    },
    async beforeLLM(messages) {
      await withSpan(tracer, 'agent.llm', (span) => {
        span.setAttribute('agent.hook.point', 'beforeLLM');
        span.setAttribute('agent.messages.count', messages.length);
      });
    },
    async afterLLM(result) {
      await withSpan(tracer, 'agent.llm', (span) => {
        span.setAttribute('agent.hook.point', 'afterLLM');
        span.setAttribute('agent.finish_reason', result.finishReason ?? 'unknown');
        if (result.usage?.totalTokens !== undefined) {
          span.setAttribute('agent.usage.total_tokens', result.usage.totalTokens);
        }
      });
    },
    async beforeToolCall(name) {
      await withSpan(tracer, 'agent.tool', (span) => {
        span.setAttribute('agent.hook.point', 'beforeToolCall');
        span.setAttribute('agent.tool.name', name);
      });
    },
    async afterToolCall(name, result) {
      await withSpan(tracer, 'agent.tool', (span) => {
        span.setAttribute('agent.hook.point', 'afterToolCall');
        span.setAttribute('agent.tool.name', name);
        span.setAttribute('agent.tool.result.length', result.length);
      });
    },
    async onStepEnd(step) {
      await withSpan(tracer, 'agent.step', (span) => {
        span.setAttribute('agent.hook.point', 'onStepEnd');
        span.setAttribute('agent.step.index', step);
      });
    },
    async onError(error, phase) {
      await withSpan(tracer, 'agent.error', (span) => {
        span.setAttribute('agent.hook.point', 'onError');
        span.setAttribute('agent.error.phase', phase);
        span.recordException(error);
        span.setStatus({ code: SPAN_STATUS_ERROR, message: error.message });
      });
    },
  };
}

/**
 * 创建 OpenTelemetry 可观测插件：经 `ctx.registerHook` 注入一个覆盖全部生命周期点的 hook，
 * 把 Agent 执行链路（LLM 调用 / 工具调用 / 步进 / 会话 / 错误）映射为 OTel span。
 * 只依赖 `@opentelemetry/api`（惰性动态 import）；exporter / 采样由用户经 OTel SDK 配置（opt-in 经 `config.plugins`）。
 */
export function createOtelPlugin(options: OtelPluginOptions = {}): Plugin {
  return {
    name: '@lhx-agent-engine/plugin-otel',
    description: '把 Agent 执行链路接入 OpenTelemetry（hooks → span）',
    version: '0.1.0',
    tags: ['otel', '可观测', 'observability'],
    async install(ctx) {
      const tracer =
        options.tracer ??
        (await import('@opentelemetry/api')).trace.getTracer(
          options.tracerName ?? '@lhx-agent-engine/plugin-otel',
        );
      ctx.registerHook(createOtelHook(tracer));
    },
  };
}
