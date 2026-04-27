import { describe, it, expect, vi } from 'vitest';
import { createTracingHandlers } from '../../src/core/handlers';

describe('handlers with adapter', () => {
  it('uses adapter trace command handlers when adapter provided', async () => {
    const fakeTracer: any = { startSpan: vi.fn(() => ({ setAttribute: vi.fn(), end: vi.fn() })) };
    const mockList = vi.fn(async (ctx: any) => ctx.ui?.notify?.('list called', 'info'));
    const mockShow = vi.fn(async (id: string, ctx: any) => ctx.ui?.notify?.(`show ${id}`, 'info'));
    const mockCommand = vi.fn(async (args: string | undefined, ctx: any) => mockList(ctx));

    const adapter = {
      id: 'test-adapter',
      configureFromEnv: () => ({}),
      createTraceCommandHandlers: (_cfg: any) => ({ listTraces: mockList, showTrace: mockShow, tracesCommandHandler: mockCommand }),
    } as any;

    const handlers = createTracingHandlers(fakeTracer as any, { mlflowTrackingUri: 'x', otlpEndpoint: 'y' } as any, adapter as any);

    const pi: any = { registerCommand: (name: string, opts: any) => { pi._last = { name, opts }; } };
    handlers.registerCommand(pi);
    expect(pi._last).toBeDefined();
    expect(pi._last.name).toBe('traces');

    // call the registered handler to ensure adapter tracesCommandHandler is invoked
    await pi._last.opts.handler('list', { ui: { notify: vi.fn() } });
    expect(mockCommand).toHaveBeenCalled();
  });
});
