import { describe, it, expect } from 'vitest';
import { setSpanAttribute } from '../../src/utils';

class BadSpan {
  setAttribute() {
    throw new Error('boom');
  }
}

class GoodSpan {
  public attrs: Record<string, any> = {};
  setAttribute(k: string, v: any) { this.attrs[k] = v; }
}

describe('setSpanAttribute', () => {
  it('does not throw when span.setAttribute throws', () => {
    const s = new BadSpan() as any;
    expect(() => setSpanAttribute(s, 'k', 'v')).not.toThrow();
  });

  it('sets attribute on good spans', () => {
    const s = new GoodSpan() as any;
    setSpanAttribute(s, 'a', 1);
    expect(s.attrs['a']).toBe(1);
  });
});
