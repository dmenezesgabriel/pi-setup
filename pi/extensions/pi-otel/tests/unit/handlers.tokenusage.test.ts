import { describe, it, expect } from 'vitest';
import { createTracingHandlers } from '../../src/core/handlers';

class FakeSpan { attrs: Record<string, any> = {}; end(){} setAttribute(k:any,v:any){ this.attrs[k]=v } }
class FakeTracer { started: FakeSpan[] = []; startSpan(n:any){ const s = new FakeSpan(); s.setAttribute('name', n); this.started.push(s); return s; } }

describe('handlers token usage extraction', () => {
  it('reads tokenUsage from event.details.tokenUsage', async () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/t1.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const before = { payload: { prompt: 'hi' }, requestId: 'r-t1' };
    await handlers.onBeforeProviderRequest(before, ctx);
    const after = { requestId: 'r-t1', details: { tokenUsage: { total: 42 } }, output: 'ok' };
    await handlers.onAfterProviderResponse(after, ctx);
    const span = tracer.started.find((s:any) => s.attrs['name'] === 'provider.request' || s.attrs['name']==='provider.response');
    expect(span).toBeDefined();
    expect(span.attrs['mlflow.trace.tokenUsage']).toBeDefined();
  });

  it('reads tokenUsage from event.tokenUsage', async () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/t2.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const before = { payload: { prompt: 'hello' }, requestId: 'r-t2' };
    await handlers.onBeforeProviderRequest(before, ctx);
    const after = { requestId: 'r-t2', tokenUsage: { total: 7 }, output: 'ok' };
    await handlers.onAfterProviderResponse(after, ctx);
    const span = tracer.started.find((s:any) => s.attrs['name'] === 'provider.request' || s.attrs['name']==='provider.response');
    expect(span).toBeDefined();
    expect(span.attrs['mlflow.trace.tokenUsage']).toBeDefined();
  });
});
