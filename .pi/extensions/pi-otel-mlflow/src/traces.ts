import type { ExtensionConfig } from './types';
import { defaultFetch, FetchFn } from './fetcher';
import { formatTraceLine, formatSpanEntry, getTraceId } from './trace-format';

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
