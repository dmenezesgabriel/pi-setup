import type { ExtensionConfig } from './types';

async function fetchJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getTraceInfo(t: any) {
  return t.trace_info ?? t.traceInfo ?? t;
}

function getTraceId(t: any) {
  const info = getTraceInfo(t);
  return info?.trace_id ?? info?.request_id ?? t.trace_id ?? '(no-id)';
}

function getTraceTimestamp(t: any) {
  const info = getTraceInfo(t);
  return info?.timestamp_ms ? new Date(Number(info.timestamp_ms)).toISOString() : '';
}

function getTraceDuration(t: any) {
  const info = getTraceInfo(t);
  return info?.execution_time_ms ? `${info.execution_time_ms}ms` : '';
}

function getRequestPreview(t: any) {
  const info = getTraceInfo(t);
  return (info?.request_preview || info?.request || t.request || '').toString();
}

function formatTraceLine(t: any): string {
  const tid = getTraceId(t);
  const ts = getTraceTimestamp(t);
  const dur = getTraceDuration(t);
  const requestPreview = getRequestPreview(t);
  return `${tid} | ${ts} | ${dur} | ${requestPreview.slice(0, 160).replace(/\n/g, ' ')}`;
}

function formatSpanEntry(s: any): string {
  const name = s?.name ?? s?.spanName ?? 'span';
  const start = s?.startTimeUnixNano
    ? new Date(Number(s.startTimeUnixNano) / 1e6).toISOString()
    : '';
  const end = s?.endTimeUnixNano ? new Date(Number(s.endTimeUnixNano) / 1e6).toISOString() : '';
  const dur =
    s?.endTimeUnixNano && s?.startTimeUnixNano
      ? `${(Number(s.endTimeUnixNano) - Number(s.startTimeUnixNano)) / 1e6}ms`
      : '';
  const line = `${name} | ${start} → ${end} | ${dur}`;
  if (s?.attributes) return `${line}\n  attrs: ${JSON.stringify(s.attributes).slice(0, 400)}`;
  return line;
}

export async function listTraces(config: ExtensionConfig, ctx: any) {
  const trackingUri = config.mlflowTrackingUri;
  const experimentId = String(config.mlflowExperimentId ?? '1');
  const url = `${trackingUri.replace(/\/$/, '')}/api/2.0/mlflow/traces/search`;
  const json = await fetchJson(url, { experiment_ids: [String(experimentId)], max_results: 20 });
  const traces = json?.traces ?? json?.results ?? [];
  if (!Array.isArray(traces) || traces.length === 0) {
    ctx.ui?.notify?.('No traces returned', 'info');
    return;
  }
  const lines = traces.map(formatTraceLine);
  ctx.ui?.setWidget?.('mlflow-traces', lines);
}

export async function showTrace(config: ExtensionConfig, id: string, ctx: any) {
  const trackingUri = config.mlflowTrackingUri;
  const url = `${trackingUri.replace(/\/$/, '')}/api/2.0/mlflow/traces/batchGet`;
  const json = await fetchJson(url, { trace_ids: [id] });
  const traces = json?.traces ?? json?.results ?? [];
  if (!Array.isArray(traces) || traces.length === 0) {
    ctx.ui?.notify?.('Trace not found', 'warning');
    return;
  }
  const trace = traces[0];
  const spans = trace?.spans ?? trace?.Spans ?? [];
  const out: string[] = [];
  out.push(`Trace ${id}`);
  out.push('---');
  for (const s of spans) out.push(formatSpanEntry(s));
  ctx.ui?.custom?.((tui: any) => new (require('@mariozechner/pi-tui').Text)(out.join('\n'), 0, 0));
}

export function createTracesHandler(config: ExtensionConfig) {
  return async function tracesHandler(args: string | undefined, ctx: any) {
    const arg = (args || '').trim();
    const [sub, id] = arg.split(/\s+/).filter(Boolean);
    if (!sub || sub === 'list') {
      await listTraces(config, ctx);
      return;
    }
    if (sub === 'show' && id) {
      await showTrace(config, id, ctx);
      return;
    }
    ctx.ui?.notify?.('Usage: /traces [list|show <traceId>]', 'info');
  };
}
