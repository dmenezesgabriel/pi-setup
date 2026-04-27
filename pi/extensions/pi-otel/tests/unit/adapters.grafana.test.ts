import { describe, it, expect } from 'vitest';
import { loadAdapter } from '../../src/adapters/loader';

describe('grafana adapter loader integration', () => {
  it('loads grafana adapter when present', async () => {
    const adapter = await loadAdapter('grafana');
    expect(adapter).toBeDefined();
    expect(adapter.id).toBe('grafana');
  });
});
