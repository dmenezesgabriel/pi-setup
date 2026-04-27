import { describe, it, expect, vi } from 'vitest';
import { listTraces, showTrace, createTracesHandler, defaultFetch, getTraceId, formatTraceLine, formatSpanEntry } from '../../src/adapters/mlflow/traces';

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

  // defaultFetch tests (moved here from fetcher.test.ts)
  it('defaultFetch returns json when ok', async () => {
    const fakeResp: any = { ok: true, json: async () => ({ data: 'ok' }) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResp));
    const res = await (await import('../../src/traces')).defaultFetch('http://test', { a: 1 } as any);
    expect(res).toEqual({ data: 'ok' });
  });

  it('defaultFetch throws when non-ok', async () => {
    const fakeResp: any = { ok: false, text: async () => 'bad' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResp));
    await expect((await import('../../src/traces')).defaultFetch('http://test', { a: 1 } as any)).rejects.toThrow('bad');
  });

  it('defaultFetch throws when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect((await import('../../src/traces')).defaultFetch('http://test', {} as any)).rejects.toThrow('network');
  });

  // trace-format helpers (moved here from trace-format.test.ts)
  it('getTraceId returns trace_id or fallback', () => {
    expect(getTraceId({ trace_info: { trace_id: 'x' } })).toBe('x');
    expect(getTraceId({ trace_id: 'y' })).toBe('y');
    expect(getTraceId({})).toBe('(no-id)');
  });

  it('formatTraceLine builds a short preview', () => {
    const t = { trace_info: { trace_id: 't', timestamp_ms: Date.now(), execution_time_ms: 10, request_preview: 'hello world' } };
    const line = formatTraceLine(t);
    expect(line).toContain('t |');
    expect(line).toContain('hello');
  });

  it('formatSpanEntry formats span entries', () => {
    const now = Date.now();
    const s = { name: 'n', startTimeUnixNano: String(now * 1e6), endTimeUnixNano: String((now + 10) * 1e6) };
    const entry = formatSpanEntry(s);
    expect(entry).toContain('n |');
    expect(entry).toContain('→');
  });
});
