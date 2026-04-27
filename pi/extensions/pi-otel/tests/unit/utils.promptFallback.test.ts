import { describe, it, expect } from 'vitest';
import { getPromptFromEvent } from '../../src/core/utils';

describe('getPromptFromEvent fallback', () => {
  it('returns JSON string when payload is object without messages or prompt', () => {
    const payload = { foo: 'bar', baz: 1 };
    const ev = { payload };
    const res = getPromptFromEvent(ev);
    expect(typeof res).toBe('string');
    expect(res).toContain('foo');
  });
});
