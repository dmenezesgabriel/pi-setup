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
  const start = s?.startTimeUnixNano
    ? new Date(Number(s.startTimeUnixNano) / 1e6).toISOString()
    : '';
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
