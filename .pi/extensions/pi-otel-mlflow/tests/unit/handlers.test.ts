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

describe('handlers', () => {
  let tracer: FakeTracer;
  let handlers: any;
  beforeEach(() => {
    tracer = new FakeTracer();
    handlers = createTracingHandlers(
      tracer as any,
      {
        mlflowTrackingUri: 'http://localhost:5000',
        otlpEndpoint: 'http://localhost:5000/v1/traces',
      } as any,
    );
  });

  it('creates root span on turn_start and attaches session', async () => {
    const ctx: any = {
      sessionManager: { getSessionFile: () => '/tmp/session123.jsonl' },
      cwd: '/cwd',
      ui: { setStatus: () => {} },
    };
    await handlers.onTurnStart({}, ctx);
    expect(tracer.started.length).toBeGreaterThan(0);
    const root = tracer.started[0];
    expect(root.attrs['mlflow.trace.session']).toBeDefined();
    expect(root.attrs['session.id']).toBeDefined();
  });

  it('before_provider_request sets mlflow.spanInputs and maps provider spans', async () => {
    const ctx: any = {
      sessionManager: { getSessionFile: () => '/tmp/sessionA.jsonl' },
      cwd: '/cwd',
    };
    await handlers.onTurnStart({}, ctx);
    const event = { payload: { prompt: 'say hi' }, provider: 'github-copilot' };
    await handlers.onBeforeProviderRequest(event, ctx);
    // a provider span should have been started by tracer
    expect(
      tracer.started.some((s) => s.attrs['mlflow.spanInputs'] || s.attrs['provider']),
    ).toBeTruthy();
  });

  it('message_end user stores prompt and assistant creates provider.response', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sessionB.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const userEvent = {
      message: { role: 'user', content: [{ type: 'text', text: 'hello' }], id: 'u1' },
    };
    await handlers.onMessageEnd(userEvent, ctx);
    const assistantEvent = {
      message: { role: 'assistant', content: 'hi!', id: 'a1' },
      parentId: 'u1',
    };
    await handlers.onMessageEnd(assistantEvent, ctx);
    // check that a provider.response span was started
    expect(
      tracer.started.some((s) => s.attrs['mlflow.spanOutputs'] || s.attrs['provider']),
    ).toBeTruthy();
  });
});
