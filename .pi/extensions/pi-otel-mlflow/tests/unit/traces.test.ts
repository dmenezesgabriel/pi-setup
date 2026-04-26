import { describe, it, expect, vi } from 'vitest';
import { listTraces, showTrace, createTracesHandler } from '../../src/traces';

const config: any = {
  mlflowTrackingUri: 'http://localhost:5000',
  mlflowExperimentId: '1',
};

describe('traces', () => {
  it('listTraces: shows traces when returned', async () => {
    const fakeTraces = [
      { trace_info: { trace_id: 't1', timestamp_ms: Date.now(), execution_time_ms: 123, request_preview: 'req1' } },
      { trace_info: { trace_id: 't2', timestamp_ms: Date.now(), execution_time_ms: 10, request_preview: 'req2' } },
    ];
    const fetchFn = vi.fn().mockResolvedValue({ traces: fakeTraces });
    const ui: any = { setWidget: vi.fn(), notify: vi.fn() };
    const ctx = { ui } as any;

    await listTraces(config, ctx, fetchFn as any);

    expect(fetchFn).toHaveBeenCalled();
    expect(ui.setWidget).toHaveBeenCalledWith('mlflow-traces', expect.any(Array));
    expect(ui.notify).not.toHaveBeenCalled();
  });

  it('listTraces: notifies when no traces returned', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ traces: [] });
    const ui: any = { setWidget: vi.fn(), notify: vi.fn() };
    const ctx = { ui } as any;

    await listTraces(config, ctx, fetchFn as any);

    expect(ui.setWidget).not.toHaveBeenCalled();
    expect(ui.notify).toHaveBeenCalledWith('No traces returned', 'info');
  });

  it('showTrace: shows trace detail when found', async () => {
    const trace = {
      spans: [
        { name: 'span1', startTimeUnixNano: String(Date.now() * 1e6), endTimeUnixNano: String((Date.now() + 10) * 1e6), attributes: { a: 1 } },
      ],
    };
    const fetchFn = vi.fn().mockResolvedValue({ traces: [trace] });
    const custom = vi.fn();
    const ui: any = { custom, notify: vi.fn() };
    const ctx = { ui } as any;

    await showTrace(config, 't1', ctx, fetchFn as any);

    expect(fetchFn).toHaveBeenCalled();
    expect(custom).toHaveBeenCalled();
    expect(ui.notify).not.toHaveBeenCalled();
  });

  it('showTrace: notifies when trace not found', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ traces: [] });
    const ui: any = { custom: vi.fn(), notify: vi.fn() };
    const ctx = { ui } as any;

    await showTrace(config, 'missing', ctx, fetchFn as any);

    expect(ui.custom).not.toHaveBeenCalled();
    expect(ui.notify).toHaveBeenCalledWith('Trace not found', 'warning');
  });

  it('createTracesHandler: list subcommand calls listTraces', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ traces: [] });
    // create handler with injected fetch
    const handler = createTracesHandler(config, fetchFn as any);
    const ui: any = { setWidget: vi.fn(), notify: vi.fn(), custom: vi.fn() };
    const ctx = { ui } as any;

    await handler('list', ctx);
    expect(fetchFn).toHaveBeenCalled();
  });
});
