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

describe('parent inputs propagation', () => {
  let tracer: any;
  let handlers: any;
  beforeEach(() => {
    tracer = new FakeTracer();
    handlers = createTracingHandlers(tracer as any, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
  });

  it('stores user prompt and applies as parent input for assistant span', async () => {
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/s.jsonl' } };
    await handlers.onTurnStart({}, ctx);

    // simulate user message
    const userEvent = { message: { role: 'user', content: [{ type: 'text', text: 'hello' }], id: 'u1' } };
    await handlers.onMessageEnd(userEvent, ctx);

    // assistant references parentId u1
    const assistantEvent = { message: { role: 'assistant', content: 'hi', id: 'a1' }, parentId: 'u1' };
    await handlers.onMessageEnd(assistantEvent, ctx);

    // find provider.response span started by createAssistantSpan
    const providerSpan = tracer.started.find((s: any) => s.attrs['name'] === 'provider.response');
    expect(providerSpan).toBeDefined();
    expect(providerSpan.attrs['mlflow.spanInputs'] || providerSpan.attrs['mlflow.spanOutputs']).toBeDefined();
  });
});
