import { describe, it, expect } from 'vitest';
import { loadAdapter } from '../../src/adapters/loader';

describe('tempo adapter loader integration', () => {
  it('loads tempo adapter when present', async () => {
    const adapter = await loadAdapter('tempo');
    expect(adapter).toBeDefined();
    expect(adapter.id).toBe('tempo');
  });
});
