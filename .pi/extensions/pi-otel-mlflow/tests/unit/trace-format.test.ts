import { describe, it, expect } from 'vitest';
import { getTraceId, formatTraceLine, formatSpanEntry } from '../../src/trace-format';

describe('trace-format', () => {
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
