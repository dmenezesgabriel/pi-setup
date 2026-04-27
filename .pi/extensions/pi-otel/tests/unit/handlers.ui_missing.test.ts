import { describe, it, expect } from 'vitest';
import { createTracingHandlers } from '../../src/core/handlers';

class FakeSpan { attrs: Record<string, any> = {}; end(){} setAttribute(k:any,v:any){ this.attrs[k]=v } }
class FakeTracer { started: FakeSpan[] = []; startSpan(n:any){ const s = new FakeSpan(); s.setAttribute('name', n); this.started.push(s); return s; } }

describe('handlers ui missing', () => {
  it('does not throw when ui exists but setStatus missing', () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/no-ui.jsonl' }, ui: {} };
    expect(() => handlers.onTurnStart({}, ctx)).not.toThrow();
    expect(() => handlers.onTurnEnd({}, ctx)).not.toThrow();
  });

  it('does not throw when ui is undefined', () => {
    const tracer = new FakeTracer() as any;
    const handlers = createTracingHandlers(tracer, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/no-ui2.jsonl' } };
    expect(() => handlers.onTurnStart({}, ctx)).not.toThrow();
    expect(() => handlers.onTurnEnd({}, ctx)).not.toThrow();
  });
});
