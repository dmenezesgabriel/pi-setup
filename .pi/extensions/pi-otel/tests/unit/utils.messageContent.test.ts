import { describe, it, expect } from 'vitest';
import { getMessageContent } from '../../src/core/utils';

describe('getMessageContent', () => {
  it('extracts from content array', () => {
    const msg = { content: [{ type: 'text', text: 'hello' }] };
    expect(getMessageContent(msg)).toBe('hello');
  });

  it('extracts from content string', () => {
    const msg = { content: 'simplestring' };
    expect(getMessageContent(msg)).toBe('simplestring');
  });

  it('extracts from payload output', () => {
    const msg = { payload: { output: { a: 1 } } };
    const res = getMessageContent(msg);
    expect(res).toContain('a');
  });

  it('returns undefined for empty message', () => {
    expect(getMessageContent(undefined)).toBeUndefined();
    expect(getMessageContent({})).toBeUndefined();
  });
});
