import { describe, it, expect, beforeEach } from 'vitest';
import { createTracingHandlers } from '../../src/core/handlers';

class FakeSpan {
  public attrs: Record<string, any> = {};
  public ended = false;
  setAttribute(k: string, v: any) { this.attrs[k] = v; }
  end() { this.ended = true; }
}
class FakeTracer {
  public started: FakeSpan[] = [];
  startSpan(name: string) { const s = new FakeSpan(); s.setAttribute('name', name); this.started.push(s); return s; }
}

describe('handlers payload message shapes', () => {
  let tracer: any;
  let handlers: any;
  beforeEach(() => {
    tracer = new FakeTracer();
    handlers = createTracingHandlers(tracer as any, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
  });

  it('extracts message from payload and id from payload.id', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/sp.jsonl' } };
    await handlers.onTurnStart({}, ctx);
    const userEvent = { message: { role: 'user', content: [{ type: 'text', text: 'hello' }], id: 'p1' } };
    await handlers.onMessageEnd(userEvent, ctx);
    // now assistant referencing parentId p1
    const assistantEvent = { message: { role: 'assistant', content: 'hi', id: 'p2' }, parentId: 'p1' };
    await handlers.onMessageEnd(assistantEvent, ctx);
    const providerSpan = tracer.started.find((s: any) => s.attrs['name'] === 'provider.response');
    expect(providerSpan).toBeDefined();
  });
});
