import { describe, expect, it } from '@rstest/core';
import type { GuardrailRuleConfig } from '@agent-engine/config';
import { compileGuardrails, createDeclarativeGuardrail } from '../src/rules/declarative';

describe('声明式 guardrail 编译', () => {
  it('denyTools 命中阻断', async () => {
    const rule = createDeclarativeGuardrail({ id: 'd', denyTools: ['builtin.bash'] });
    const verdict = await rule.validate({ toolName: 'builtin.bash' });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('builtin.bash');
  });

  it('allowTools 白名单：不在内阻断、在内放行', async () => {
    const rule = createDeclarativeGuardrail({ id: 'a', allowTools: ['builtin.todo'] });
    expect((await rule.validate({ toolName: 'builtin.bash' })).allowed).toBe(false);
    expect((await rule.validate({ toolName: 'builtin.todo' })).allowed).toBe(true);
  });

  it('denyPatterns 命中入参阻断', async () => {
    const rule = createDeclarativeGuardrail({ id: 'p', denyPatterns: ['rm -rf'] });
    const verdict = await rule.validate({ toolName: 'builtin.bash', args: '{"cmd":"rm -rf /"}' });
    expect(verdict.allowed).toBe(false);
  });

  it('denyPatterns 命中结果（afterToolCall）阻断', async () => {
    const rule = createDeclarativeGuardrail({
      id: 'p',
      on: 'afterToolCall',
      denyPatterns: ['password'],
    });
    const verdict = await rule.validate({ toolName: 'read_file', result: '{"password":"x"}' });
    expect(verdict.allowed).toBe(false);
  });

  it('deny 优先于 allow', async () => {
    const rule = createDeclarativeGuardrail({
      id: 'mixed',
      allowTools: ['builtin.bash'],
      denyTools: ['builtin.bash'],
    });
    expect((await rule.validate({ toolName: 'builtin.bash' })).allowed).toBe(false);
  });

  it('无命中放行', async () => {
    const rule = createDeclarativeGuardrail({ id: 'open' });
    expect((await rule.validate({ toolName: 'builtin.todo' })).allowed).toBe(true);
  });

  it('compileGuardrails 保持 id/on 与条数', () => {
    const configs: GuardrailRuleConfig[] = [
      { id: 'a', on: 'beforeToolCall' },
      { id: 'b', on: 'afterToolCall', denyPatterns: ['x'] },
    ];
    const rules = compileGuardrails(configs);
    expect(rules.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rules.map((r) => r.on)).toEqual(['beforeToolCall', 'afterToolCall']);
  });

  it('非法正则在编译期抛错', () => {
    expect(() => compileGuardrails([{ id: 'bad', denyPatterns: ['('] }])).toThrow();
  });
});
