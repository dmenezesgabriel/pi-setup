import type { ExtensionConfig } from './types';

// Inlined fetcher + trace-format helpers to reduce fragmentation
export type FetchFn = (url: string, body: any) => Promise<any>;

export const defaultFetch: FetchFn = async (url: string, body: any) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export function getTraceInfo(t: any) {
  return t.trace_info ?? t.traceInfo ?? t;
}

export function getTraceId(t: any) {
  const info = getTraceInfo(t);
  return info?.trace_id ?? info?.request_id ?? t.trace_id ?? '(no-id)';
}

export function getTraceTimestamp(t: any) {
  const info = getTraceInfo(t);
  return info?.timestamp_ms ? new Date(Number(info.timestamp_ms)).toISOString() : '';
}

export function getTraceDuration(t: any) {
  const info = getTraceInfo(t);
  return info?.execution_time_ms ? `${info.execution_time_ms}ms` : '';
}

export function getRequestPreview(t: any) {
  const info = getTraceInfo(t);
  return (info?.request_preview || info?.request || t.request || '').toString();
}

export function formatTraceLine(t: any): string {
  const tid = getTraceId(t);
  const ts = getTraceTimestamp(t);
  const dur = getTraceDuration(t);
  const requestPreview = getRequestPreview(t);
  return `${tid} | ${ts} | ${dur} | ${requestPreview.slice(0, 160).replace(/\n/g, ' ')}`;
}

export function getSpanName(s: any): string {
  return s?.name ?? s?.spanName ?? 'span';
}

export function getSpanTimes(s: any): { start: string; end: string } {
  const start = s?.startTimeUnixNano ? new Date(Number(s.startTimeUnixNano) / 1e6).toISOString() : '';
  const end = s?.endTimeUnixNano ? new Date(Number(s.endTimeUnixNano) / 1e6).toISOString() : '';
  return { start, end };
}

export function getSpanDuration(s: any): string {
  return s?.endTimeUnixNano && s?.startTimeUnixNano
    ? `${(Number(s.endTimeUnixNano) - Number(s.startTimeUnixNano)) / 1e6}ms`
    : '';
}

export function formatSpanEntry(s: any): string {
  const name = getSpanName(s);
  const { start, end } = getSpanTimes(s);
  const dur = getSpanDuration(s);
  const line = `${name} | ${start} → ${end} | ${dur}`;
  if (s?.attributes) return `${line}\n  attrs: ${JSON.stringify(s.attributes).slice(0, 400)}`;
  return line;
}

function getTracesFromJson(json: any) {
  return json?.traces ?? json?.results ?? [];
}

function renderTracesWidget(ctx: any, traces: any[]) {
  if (!Array.isArray(traces) || traces.length === 0) {
    ctx.ui?.notify?.('No traces returned', 'info');
    return;
  }
  const lines = traces.map(formatTraceLine);
  ctx.ui?.setWidget?.('mlflow-traces', lines);
}

export async function listTraces(config: ExtensionConfig, ctx: any, fetchFn?: FetchFn) {
  const fetcher = fetchFn ?? defaultFetch;
  const trackingUri = config.mlflowTrackingUri;
  const experimentId = String(config.mlflowExperimentId ?? '1');
  const url = `${trackingUri.replace(/\/$/, '')}/api/2.0/mlflow/traces/search`;
  const json = await fetcher(url, { experiment_ids: [String(experimentId)], max_results: 20 });
  const traces = getTracesFromJson(json);
  renderTracesWidget(ctx, traces);
}

function renderTraceDetail(ctx: any, trace: any, id?: string) {
  const spans = trace?.spans ?? trace?.Spans ?? [];
  const out: string[] = [];
  out.push(`Trace ${id ?? getTraceId(trace)}`);
  out.push('---');
  for (const s of spans) out.push(formatSpanEntry(s));
  ctx.ui?.custom?.((tui: any) => new (require('@mariozechner/pi-tui').Text)(out.join('\n'), 0, 0));
}

export async function showTrace(config: ExtensionConfig, id: string, ctx: any, fetchFn?: FetchFn) {
  const fetcher = fetchFn ?? defaultFetch;
  const trackingUri = config.mlflowTrackingUri;
  const url = `${trackingUri.replace(/\/$/, '')}/api/2.0/mlflow/traces/batchGet`;
  const json = await fetcher(url, { trace_ids: [id] });
  const traces = getTracesFromJson(json);
  if (!Array.isArray(traces) || traces.length === 0) {
    ctx.ui?.notify?.('Trace not found', 'warning');
    return;
  }
  const trace = traces[0];
  renderTraceDetail(ctx, trace, id);
}

export function createTracesHandler(config: ExtensionConfig, fetchFn?: FetchFn) {
  return async function tracesHandler(args: string | undefined, ctx: any) {
    const fetcher = fetchFn ?? defaultFetch;
    const arg = (args || '').trim();
    const [sub, id] = arg.split(/\s+/).filter(Boolean);
    if (!sub || sub === 'list') {
      await listTraces(config, ctx, fetcher);
      return;
    }
    if (sub === 'show' && id) {
      await showTrace(config, id, ctx, fetcher);
      return;
    }
    ctx.ui?.notify?.('Usage: /traces [list|show <traceId>]', 'info');
  };
}
