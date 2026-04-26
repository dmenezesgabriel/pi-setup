import { describe, it, expect, beforeEach } from 'vitest';
import { createTracingHandlers } from '../../src/handlers';

class FakeSpan {
  public attrs: Record<string, any> = {};
  public ended = false;
  setAttribute(k: string, v: any) {
    this.attrs[k] = v;
  }
  setStatus(s: any) {
    this.attrs['status'] = s;
  }
  end() {
    this.ended = true;
  }
}

class FakeTracer {
  public started: FakeSpan[] = [];
  startSpan(name: string) {
    const s = new FakeSpan();
    s.setAttribute('name', name);
    this.started.push(s);
    return s;
  }
}

const config: any = { mlflowTrackingUri: 'http://localhost:5000', otlpEndpoint: 'http://localhost:5000/v1/traces' };

describe('handlers extra', () => {
  let tracer: FakeTracer;
  let handlers: any;

  beforeEach(() => {
    tracer = new FakeTracer();
    handlers = createTracingHandlers(tracer as any, config as any);
  });

  it('onAfterProviderResponse applies tokenUsage, outputs and error status', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sessionA.jsonl' }, cwd: '/cwd' };
    await handlers.onTurnStart({}, ctx);

    const eventBefore = { payload: { prompt: 'say hi' }, provider: 'github-copilot', requestId: 'r1' };
    await handlers.onBeforeProviderRequest(eventBefore, ctx);

    const eventAfter = {
      requestId: 'r1',
      details: { tokenUsage: { total: 10 } },
      stopReason: 'error',
      status: 'error',
      errorMessage: 'boom',
      output: 'hi',
    };

    await handlers.onAfterProviderResponse(eventAfter, ctx);

    // provider span should have been ended and have attributes set
    const providerSpan = tracer.started.find((s) => s.attrs['name'] === 'provider.request' || s.attrs['name'] === 'provider.response');
    expect(providerSpan).toBeDefined();
    expect(providerSpan?.attrs['mlflow.trace.tokenUsage']).toBeDefined();
    expect(providerSpan?.attrs['mlflow.spanOutputs']).toBeDefined();
    expect(providerSpan?.attrs['status']).toBeDefined();
    expect(providerSpan?.ended).toBe(true);
  });

  it('onToolCall and onToolResult create and finalize tool spans', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sessionTool.jsonl' } };
    await handlers.onTurnStart({}, ctx);

    const eventCall = { toolName: 'search', toolCallId: 'tc1', input: { q: 'abc' } };
    await handlers.onToolCall(eventCall, ctx);

    // find started tool span
    const toolSpan = tracer.started.find((s) => s.attrs['name'] === `tool.${eventCall.toolName}`);
    expect(toolSpan).toBeDefined();
    expect(toolSpan?.attrs['tool.name']).toBe('search');

    const eventResult = { toolCallId: 'tc1', details: { ok: true }, isError: true, details: { error: 'x' } };
    await handlers.onToolResult(eventResult, ctx);

    // tool span should be finalized and ended
    expect(toolSpan?.attrs['tool.details']).toBeDefined();
    expect(toolSpan?.attrs['status']).toBeDefined();
    expect(toolSpan?.ended).toBe(true);
  });

  it('onTurnEnd finalizes and clears maps', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sessionEnd.jsonl' }, ui: { setStatus: () => {} } };
    await handlers.onTurnStart({}, ctx);

    // simulate user message saved
    const userEvent = { message: { role: 'user', content: [{ type: 'text', text: 'hello' }], id: 'u1' } };
    await handlers.onMessageEnd(userEvent, ctx);

    const assistantEvent = {
      message: { role: 'assistant', content: 'hi!', id: 'a1' },
      parentId: 'u1',
    };
    await handlers.onMessageEnd(assistantEvent, ctx);

    // now end turn
    await handlers.onTurnEnd({}, ctx);

    // root span should have been ended and mapping cleared
    const root = tracer.started.find((s) => s.attrs['name'] === 'pi.turn');
    expect(root).toBeDefined();
    expect(root?.ended).toBe(true);
  });

  it('registerCommand registers traces command', () => {
    const pi: any = { registerCommand: (name: string, opts: any) => { pi.called = { name, opts }; } };
    handlers.registerCommand(pi);
    expect(pi.called).toBeDefined();
    expect(pi.called.name).toBe('traces');
    expect(pi.called.opts).toHaveProperty('handler');
  });
});
