import { describe, it, expect } from 'vitest';
import { createTracingHandlers } from '../../src/core/handlers';

class FakeSpan { attrs: Record<string, any> = {}; end(){} setAttribute(k:any,v:any){ this.attrs[k]=v } setStatus(s:any){ this.attrs['status'] = s } }
class FakeTracer { started: FakeSpan[] = []; startSpan(n:any){ const s = new FakeSpan(); s.setAttribute('name', n); this.started.push(s); return s; } }

describe('handlers stop reason handling', () => {
  it('sets status when stopReason present in event.stopReason', async () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sr1.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const before = { payload: { prompt: 'h' }, requestId: 'r-sr1' };
    await handlers.onBeforeProviderRequest(before, ctx);
    const after = { requestId: 'r-sr1', stopReason: 'error', status: 'error', errorMessage: 'boom' };
    await handlers.onAfterProviderResponse(after, ctx);
    const span = tracer.started.find((s:any) => s.attrs['name'] === 'provider.request' || s.attrs['name']==='provider.response');
    expect(span).toBeDefined();
    expect(span.attrs['status']).toBeDefined();
  });

  it('sets status when stop_reason present in event.details', async () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sr2.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const before = { payload: { prompt: 'h' }, requestId: 'r-sr2' };
    await handlers.onBeforeProviderRequest(before, ctx);
    const after = { requestId: 'r-sr2', details: { stop_reason: 'error' }, status: 'error', errorMessage: 'boom2' };
    await handlers.onAfterProviderResponse(after, ctx);
    const span = tracer.started.find((s:any) => s.attrs['name'] === 'provider.request' || s.attrs['name']==='provider.response');
    expect(span).toBeDefined();
    expect(span.attrs['status']).toBeDefined();
  });
});
