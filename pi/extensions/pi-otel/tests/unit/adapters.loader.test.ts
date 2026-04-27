import { describe, it, expect, beforeEach } from 'vitest';
import { loadAdapter } from '../../src/adapters/loader';

describe('adapter loader', () => {
  beforeEach(() => {
    delete process.env.OTEL_ADAPTER;
  });

  it('loads default mlflow adapter when OTEL_ADAPTER not set', async () => {
    const adapter = await loadAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.id).toBe('mlflow');
  });

  it('loads adapter by name', async () => {
    process.env.OTEL_ADAPTER = 'mlflow';
    const adapter = await loadAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.id).toBe('mlflow');
  });

  it('throws when adapter not found', async () => {
    await expect(loadAdapter('no_such_adapter')).rejects.toThrow();
  });
});
