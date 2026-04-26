import { describe, it, expect } from 'vitest';
import {
  parseHeaders,
  truncateText,
  normalizeSessionId,
  getPromptFromEvent,
  getOutputFromEvent,
} from '../../src/utils';

describe('utils', () => {
  it('parseHeaders handles formats', () => {
    expect(parseHeaders('k=v,k2=v2')).toEqual({ k: 'v', k2: 'v2' });
    expect(parseHeaders('k: v; k2: v2')).toEqual({ k: 'v', k2: 'v2' });
    expect(parseHeaders(null)).toBeUndefined();
  });

  it('truncateText truncates long strings', () => {
    const s = 'a'.repeat(5000);
    const t = truncateText(s, 200);
    expect(t).toContain('...(');
    expect(t?.length).toBeGreaterThan(0);
  });

  it('normalizeSessionId creates safe id', () => {
    expect(normalizeSessionId('/home/user/.pi/session-1.jsonl')).toMatch(
      /session-1.jsonl|session-1_jsonl/,
    );
    expect(normalizeSessionId('weird name!@#')).toEqual('weird_name___');
  });

  it('getPromptFromEvent handles messages array and prompt field', () => {
    const ev1 = { payload: { messages: [{ role: 'user', content: 'hello' }] } };
    expect(getPromptFromEvent(ev1)).toContain('user: hello');
    const ev2 = { payload: { prompt: 'direct prompt' } };
    expect(getPromptFromEvent(ev2)).toContain('direct prompt');
  });

  it('getOutputFromEvent handles output and choices', () => {
    const ev1 = { output: 'hi there' };
    expect(getOutputFromEvent(ev1)).toBe('hi there');
    const ev2 = { choices: ['a', 'b'] };
    expect(getOutputFromEvent(ev2)).toContain('a');
  });
});
