import { describe, it, expect, beforeEach } from 'vitest';
import { createTracingHandlers } from '../../src/handlers';

class FakeSpan {
  public attrs: Record<string, any> = {};
  public ended = false;
  setAttribute(k: string, v: any) { this.attrs[k] = v; }
  setStatus(s: any) { this.attrs['status'] = s; }
  end() { this.ended = true; }
}
class FakeTracer {
  public started: FakeSpan[] = [];
  startSpan(name: string) { const s = new FakeSpan(); s.setAttribute('name', name); this.started.push(s); return s; }
}

describe('handlers model/provider attributes and event-object mapping', () => {
  let tracer: any;
  let handlers: any;
  beforeEach(() => {
    tracer = new FakeTracer();
    handlers = createTracingHandlers(tracer as any, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
  });

  it('sets model_id and provider on provider.request span', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/s1.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const event = { payload: { model: 'gpt-foo' }, api: 'openai', requestId: 'r-1' };
    await handlers.onBeforeProviderRequest(event, ctx);

    const providerSpan = tracer.started.find((s: any) => s.attrs['name'] === 'provider.request');
    expect(providerSpan).toBeDefined();
    expect(providerSpan.attrs['mlflow.model_id']).toBe('gpt-foo');
    expect(providerSpan.attrs['provider']).toBe('openai');
  });

  it('retrieves provider span by event object when no id present', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/s2.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const event: any = { payload: { prompt: 'hello' } };
    // no requestId set -> will create provider span and also store object mapping
    await handlers.onBeforeProviderRequest(event, ctx);
    // simulate after response using same event object (no requestId)
    const eventAfter: any = event; // same object reference
    eventAfter.output = 'ok';
    await handlers.onAfterProviderResponse(eventAfter, ctx);

    // expect a provider span to have been started and ended
    const providerSpan = tracer.started.find((s: any) => s.attrs['name'] === 'provider.request' || s.attrs['name'] === 'provider.response');
    expect(providerSpan).toBeDefined();
    expect(providerSpan.ended).toBe(true);
    expect(providerSpan.attrs['mlflow.spanOutputs']).toBeDefined();
  });
});
