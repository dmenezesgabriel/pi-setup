import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defaultFetch } from '../../src/fetcher';

describe('fetcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defaultFetch returns json when ok', async () => {
    const fakeResp = { ok: true, json: async () => ({ data: 'ok' }) } as any;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResp));

    const res = await defaultFetch('http://test', { a: 1 } as any);
    expect(res).toEqual({ data: 'ok' });
    expect((globalThis.fetch as any)).toHaveBeenCalled();
  });

  it('defaultFetch throws when non-ok', async () => {
    const fakeResp = { ok: false, text: async () => 'bad' } as any;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResp));

    await expect(defaultFetch('http://test', { a: 1 } as any)).rejects.toThrow('bad');
  });

  it('defaultFetch throws when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(defaultFetch('http://test', {} as any)).rejects.toThrow('network');
  });
});
