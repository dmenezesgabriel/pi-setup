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

describe('handlers additional cases', () => {
  let tracer: any;
  let handlers: any;
  beforeEach(() => {
    tracer = new FakeTracer();
    handlers = createTracingHandlers(tracer as any, { mlflowTrackingUri: 'http://localhost', otlpEndpoint: 'http://localhost/v1/traces' } as any);
  });

  it('onBeforeProviderRequest does nothing when no turnId resolved', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => null } };
    // no turn started for this session
    const event = { payload: { prompt: 'hi' } };
    await handlers.onBeforeProviderRequest(event, ctx);
    // tracer should have no provider spans started (only maybe turn spans if started)
    const hasProvider = tracer.started.some((s: any) => s.attrs['name'] === 'provider.request');
    expect(hasProvider).toBe(false);
  });

  it('onAfterProviderResponse safely returns when no span found', async () => {
    const ctx: any = {};
    const event = { requestId: 'no-such-id' };
    // should not throw
    await handlers.onAfterProviderResponse(event, ctx);
  });
});
