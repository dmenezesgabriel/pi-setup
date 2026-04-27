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

describe('handlers UI status behavior', () => {
  let tracer: any;
  let handlers: any;
  beforeEach(() => {
    tracer = new FakeTracer();
    handlers = createTracingHandlers(tracer as any, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any);
  });

  it('onTurnStart calls ui.setStatus with telemetry trace id', async () => {
    const ui = { setStatus: vi.fn() } as any;
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/su.jsonl' }, ui };
    await handlers.onTurnStart({}, ctx);
    expect(ui.setStatus).toHaveBeenCalled();
    const args = ui.setStatus.mock.calls[0];
    expect(args[0]).toBe('telemetry');
    expect(typeof args[1]).toBe('string');
    expect(args[1]).toMatch(/^trace /);
  });

  it('onTurnEnd clears ui.setStatus telemetry', async () => {
    const ui = { setStatus: vi.fn() } as any;
    const ctx: any = { sessionManager: { getSessionFile: () => '/tmp/se.jsonl' }, ui };
    await handlers.onTurnStart({}, ctx);
    await handlers.onTurnEnd({}, ctx);
    // last call should set telemetry to undefined
    const lastCall = ui.setStatus.mock.calls[ui.setStatus.mock.calls.length - 1];
    expect(lastCall[0]).toBe('telemetry');
    expect(lastCall[1]).toBeUndefined();
  });
});
