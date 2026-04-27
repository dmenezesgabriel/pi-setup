import type { ExtensionConfig } from '../../core/types';
import { truncateText } from '../../core/utils';

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
  const raw = info?.request_preview ?? info?.request ?? t.request ?? '';
  const parsed = tryParseJsonLax(raw);
  try {
    const preview = formatInputsPreview(parsed ?? raw);
    if (preview) return preview;
  } catch (e) {
    // ignore
  }
  const s = raw == null ? '' : String(raw);
  return s.trim().slice(0, 1000);
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

function tryParseJsonLax(raw: any): any {
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;
  const s = raw.trim();
  if (!s) return '';
  // direct parse
  try {
    return JSON.parse(s);
  } catch (e) {
    // if it's a quoted JSON string: try to unquote then parse
    if ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'")) {
      try {
        const unq = JSON.parse(s);
        if (typeof unq === 'string') {
          try {
            return JSON.parse(unq);
          } catch (e2) {
            return unq;
          }
        }
        return unq;
      } catch (e2) {}
    }
    // try to extract first JSON object/array inside string
    const firstIdx = Math.min(
      ...['{', '[']
        .map((c) => s.indexOf(c))
        .filter((i) => i >= 0)
    );
    if (Number.isFinite(firstIdx) && firstIdx >= 0) {
      const lastIdxCandidates: number[] = [];
      if (s.lastIndexOf(']') >= 0) lastIdxCandidates.push(s.lastIndexOf(']'));
      if (s.lastIndexOf('}') >= 0) lastIdxCandidates.push(s.lastIndexOf('}'));
      if (lastIdxCandidates.length) {
        const lastIdx = Math.max(...lastIdxCandidates);
        if (lastIdx > firstIdx) {
          const sub = s.slice(firstIdx, lastIdx + 1);
          try {
            return JSON.parse(sub);
          } catch (e3) {
            // fall through
          }
        }
      }
    }
    // final attempt: unescape common escape sequences and parse
    try {
      const unesc = s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return JSON.parse(unesc);
    } catch (e4) {
      return s;
    }
  }
}

function extractMessageContent(entry: any): string {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry.content === 'string') return entry.content;
  if (typeof entry.text === 'string') return entry.text;
  if (typeof entry.message === 'string') return entry.message;
  if (typeof entry.body === 'string') return entry.body;
  if (entry.payload) {
    if (typeof entry.payload.text === 'string') return entry.payload.text;
    if (typeof entry.payload.content === 'string') return entry.payload.content;
  }
  try {
    return JSON.stringify(entry);
  } catch (e) {
    return String(entry);
  }
}

function formatInputsPreview(value: any): string {
  const parsed = tryParseJsonLax(value);
  if (!parsed) return '';

  // If array of message entries
  if (Array.isArray(parsed)) {
    const systemEntry = parsed.find((m: any) => {
      const r = (m && (m.role ?? m.name ?? m.type)) || '';
      return r === 'system' || r === 'developer';
    });
    const userEntry = ([...parsed].reverse().find((m: any) => {
      const r = (m && (m.role ?? m.name ?? m.type)) || '';
      return r === 'user' || r === 'human';
    }) as any) || parsed.find((m: any) => {
      const r = (m && (m.role ?? m.name ?? m.type)) || '';
      return r === 'user' || r === 'human';
    });

    const parts: string[] = [];
    if (systemEntry) parts.push(`SYSTEM: ${truncateText(extractMessageContent(systemEntry), 300)}`);
    if (userEntry) parts.push(`USER: ${truncateText(extractMessageContent(userEntry), 800)}`);
    if (parts.length) return parts.join('\n\n');

    // Fallback: show joined content
    const joined = parsed.map((p: any) => extractMessageContent(p)).filter(Boolean).join('\n---\n');
    return truncateText(joined, 600);
  }

  // If object with messages
  if (typeof parsed === 'object') {
    const messages = parsed.messages ?? parsed.message ?? parsed.payload?.messages;
    if (Array.isArray(messages)) {
      const systemEntry = messages.find((m: any) => {
        const r = (m && (m.role ?? m.name ?? m.type)) || '';
        return r === 'system' || r === 'developer';
      });
      const userEntry = ([...messages].reverse().find((m: any) => {
        const r = (m && (m.role ?? m.name ?? m.type)) || '';
        return r === 'user' || r === 'human';
      }) as any) || messages.find((m: any) => {
        const r = (m && (m.role ?? m.name ?? m.type)) || '';
        return r === 'user' || r === 'human';
      });
      const parts: string[] = [];
      if (systemEntry) parts.push(`SYSTEM: ${truncateText(extractMessageContent(systemEntry), 300)}`);
      if (userEntry) parts.push(`USER: ${truncateText(extractMessageContent(userEntry), 800)}`);
      if (parts.length) return parts.join('\n\n');
    }

    const direct = parsed.prompt ?? parsed.input ?? parsed.request ?? parsed;
    if (direct) return truncateText(typeof direct === 'string' ? direct : JSON.stringify(direct), 800);
  }

  // Fallback: raw string
  return truncateText(String(parsed), 800);
}

export function formatSpanEntry(s: any): string {
  const name = getSpanName(s);
  const { start, end } = getSpanTimes(s);
  const dur = getSpanDuration(s);
  const line = `${name} | ${start} → ${end} | ${dur}`;

  const attrs = s?.attributes ?? s?.Attributes ?? null;
  if (!attrs) return line;

  const formatted: string[] = [];

  if (attrs['mlflow.spanInputs']) {
    const preview = formatInputsPreview(attrs['mlflow.spanInputs']);
    if (preview) formatted.push(`inputs: ${preview.replace(/\n/g, '\n  ')}`);
  }
  if (attrs['mlflow.request'] && !attrs['mlflow.spanInputs']) {
    const preview = formatInputsPreview(attrs['mlflow.request']);
    if (preview) formatted.push(`request: ${preview.replace(/\n/g, '\n  ')}`);
  }
  if (attrs['mlflow.spanOutputs']) {
    const out = tryParseJsonLax(attrs['mlflow.spanOutputs']);
    const outStr = typeof out === 'string' ? out : JSON.stringify(out);
    formatted.push(`outputs: ${truncateText(outStr, 800).replace(/\n/g, '\n  ')}`);
  }
  // common attributes
  if (attrs['mlflow.model_id']) formatted.push(`model: ${attrs['mlflow.model_id']}`);
  if (attrs['provider']) formatted.push(`provider: ${typeof attrs['provider'] === 'string' ? attrs['provider'] : JSON.stringify(attrs['provider'])}`);
  if (attrs['stop_reason']) formatted.push(`stop_reason: ${attrs['stop_reason']}`);
  if (attrs['tool.name']) formatted.push(`tool: ${attrs['tool.name']}`);

  // If we didn't format anything special, fall back to a truncated JSON attrs
  if (formatted.length === 0) return `${line}\n  attrs: ${JSON.stringify(attrs).slice(0, 400)}`;

  return `${line}\n  ${formatted.join('\n  ')}`;
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
