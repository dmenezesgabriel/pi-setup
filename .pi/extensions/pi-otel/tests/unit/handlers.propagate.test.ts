import { describe, it, expect } from 'vitest';
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

describe('handlers prompt propagation and error status', () => {
  it('propagates prompt to provider and root spans', async () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sp1.jsonl' } };
    await handlers.onTurnStart({}, ctx);

    const evBefore = { payload: { prompt: 'hello world' }, requestId: 'r1' };
    await handlers.onBeforeProviderRequest(evBefore, ctx);

    // find provider.request span
    const pspan = tracer.started.find((s: any) => s.attrs['name'] === 'provider.request');
    expect(pspan).toBeDefined();
    expect(pspan.attrs['mlflow.spanInputs']).toContain('hello');

    // root should also have span inputs
    const root = tracer.started.find((s: any) => s.attrs['name'] === 'pi.turn');
    expect(root).toBeDefined();
    expect(root.attrs['mlflow.spanInputs']).toContain('hello');
  });

  it('applyErrorStatus sets span status on error', async () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sp2.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const evBefore = { payload: { prompt: 'hi' }, requestId: 'r2' };
    await handlers.onBeforeProviderRequest(evBefore, ctx);
    const evAfter = { requestId: 'r2', status: 'error', errorMessage: 'boom' };
    await handlers.onAfterProviderResponse(evAfter, ctx);

    const providerSpan = tracer.started.find((s: any) => s.attrs['name'] === 'provider.request' || s.attrs['name'] === 'provider.response');
    expect(providerSpan).toBeDefined();
    expect(providerSpan.attrs['status']).toBeDefined();
    expect(providerSpan.attrs['status'].message).toContain('boom');
  });
});
